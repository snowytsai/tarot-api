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

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20
});

app.use("/tarot", limiter);

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

請寫約250字解讀：
包含
1. 此刻狀態
2. 可能發展
3. 建議
`;

    const response = await client.responses.create({
      model: "gpt-5-mini",
      input: prompt,
      max_output_tokens: 400
    });

    res.json({
      reading: response.output_text
    });

  } catch (error) {
    res.status(500).json({ error: "AI解牌失敗" });
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

請寫約400字解讀：
包含
整體狀態、發展方向與建議
`;

    const response = await client.responses.create({
      model: "gpt-5-mini",
      input: prompt,
      max_output_tokens: 400
    });

    res.json({
      reading: response.output_text
    });

  } catch (error) {
    res.status(500).json({ error: "AI解牌失敗" });
  }
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Tarot API running");
});
