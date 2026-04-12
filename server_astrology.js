import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const APP_API_KEY = process.env.APP_API_KEY;

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20
});

app.use("/tarot", limiter);

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

app.post("/tarot/daily-astrology", async (req, res) => {
  try {
    // 先用固定假資料測試流程
    const astrologyText =
      "🌙 月亮在巨蟹座｜情緒感受較為敏感\n☿ 水星順行｜溝通逐漸清晰";

    res.json({
      astrologyText
    });
  } catch (error) {
    console.error("daily astrology error =", error);
    res.status(500).json({
      error: "星象取得失敗",
      detail: error?.message || "unknown error"
    });
  }
});

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "astrology" });
});

const PORT = process.env.ASTROLOGY_PORT || 3001;

app.listen(PORT, () => {
  console.log(`Astrology API running on port ${PORT}`);
});
