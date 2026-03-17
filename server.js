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

// ⭐ 新增：App API Key
const APP_API_KEY = process.env.APP_API_KEY;

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20
});

app.use("/tarot", limiter);

// ⭐ 新增：API Key 檢查
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
      max_output_tokens: 500
    });

    const text = extractText(response);

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
