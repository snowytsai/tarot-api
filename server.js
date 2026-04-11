import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ⭐ App API Key
const APP_API_KEY = process.env.APP_API_KEY;

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20
});

app.use("/tarot", limiter);

// ⭐ API Key 檢查
function checkApiKey(req, res, next) {
  const key = req.headers["x-api-key"];

  if (!key || key !== APP_API_KEY) {
    return res.status(403).json({
      error: "API key invalid"
    });
  }

  next();
}

app.use("/tarot", checkApiKey);

function extractText(response) {
  try {
    if (response.output_text) {
      return response.output_text.trim();
    }

    const text = response.output?.[0]?.content?.[0]?.text;
    if (text) {
      return text.trim();
    }

    return "";
  } catch {
    return "";
  }
}

// =========================
// 本日塔羅 daily
// =========================
app.post("/tarot/daily", async (req, res) => {
  try {
    const { question, category, cardName, isReversed } = req.body;

    const prompt = `
你是一位風格溫和、準確且適合社群分享的塔羅解牌者。
請根據以下牌卡內容，用繁體中文產出「本日塔羅指引」。

請務必只輸出 JSON，不要加任何其他說明、不要加 markdown、不要加 \`\`\`。

JSON 格式如下：
{
  "keywords": ["關鍵詞1", "關鍵詞2", "關鍵詞3"],
  "shortSummary": "一句簡短提醒",
  "longReading": "完整解析"
}

規則：
1. keywords：請提供 3～5 個本日關鍵詞，簡短、有感覺、適合分享圖卡，例如：轉機、停滯、觀察、壓力、突破。
2. shortSummary：一句 20～40 字的今日提醒，簡短有力。
3. longReading：180～300 字，包含此刻狀態、今天可能發展、以及建議，語氣自然溫和。

問題：${question}
分類：${category}
牌：${cardName}
牌位：${isReversed ? "逆位" : "正位"}
`;

    const response = await client.responses.create({
      model: "gpt-5-mini",
      input: prompt,
      max_output_tokens: 900
    });

    const text = extractText(response);

    console.log("daily raw response =", JSON.stringify(response, null, 2));
    console.log("daily text =", text);

    let result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      console.error("daily parse error =", e);
      return res.json({
        keywords: ["解析失敗"],
        shortSummary: "請重新嘗試一次",
        longReading: text || "暫時無法取得本日解牌內容"
      });
    }

    res.json({
      keywords: Array.isArray(result.keywords) ? result.keywords : ["今日指引"],
      shortSummary: result.shortSummary || "今天適合放慢腳步，重新整理方向。",
      longReading: result.longReading || "暫時無法取得本日解牌內容"
    });

  } catch (error) {
    console.error("daily tarot error =", error);
    res.status(500).json({
      error: "AI解牌失敗",
      detail: error?.message || "unknown error"
    });
  }
});

// =========================
// 單張塔羅 single
// =========================
app.post("/tarot/single", async (req, res) => {
  try {
    const { question, category, cardName, isReversed } = req.body;

    const prompt = `
你是一位溫和理性的塔羅解牌者。
請用繁體中文解讀以下牌卡。

問題：${question}
分類：${category}
牌：${cardName}
牌位：${isReversed ? "逆位" : "正位"}

請提供：
1. 此刻狀態
2. 可能發展
3. 建議

控制在200字內。
`;

    const response = await client.responses.create({
      model: "gpt-5-mini",
      input: prompt,
      max_output_tokens: 700
    });

    console.log("single raw response =", JSON.stringify(response, null, 2));

    const text =
      response.output_text?.trim() ||
      response.output?.flatMap(item => item.content || [])
        ?.map(item => item.text || "")
        ?.join("\n")
        ?.trim() ||
      "";

    res.json({
      reading: text || "暫時無法取得解牌內容"
    });

  } catch (error) {
    console.error("single tarot error =", error);
    res.status(500).json({
      error: "AI解牌失敗",
      detail: error?.message || "unknown error"
    });
  }
});

// =========================
// 三張塔羅 three
// =========================
app.post("/tarot/three", async (req, res) => {
  try {
    const { question, category, cards } = req.body;

    const cardsText = cards.map(
      c => `${c.label}：${c.name}（${c.isReversed ? "逆位" : "正位"}）`
    ).join("\n");

    const prompt = `
請用繁體中文解讀以下三張塔羅牌。

問題：${question}
分類：${category}

${cardsText}

請提供：
1. 整體狀態
2. 發展方向
3. 建議

控制在300字內。
`;

    const response = await client.responses.create({
      model: "gpt-5-mini",
      input: prompt,
      max_output_tokens: 900
    });

    const text = extractText(response);

    res.json({
      reading: text || "暫時無法取得解牌內容"
    });

  } catch (error) {
    console.error("three tarot error =", error);
    res.status(500).json({
      error: "AI解牌失敗",
      detail: error?.message || "unknown error"
    });
  }
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Tarot API running");
});
