import { STORY_KNOWLEDGE } from "./story-knowledge.mjs";

const SYSTEM_PROMPT = `
Сен — «Ертегілер әлемі 2.0» платформасындағы виртуалды Ер Төстіксің.
Сөйлесушілер — 6-сынып оқушылары. Қазақ тілінде, жылы, түсінікті,
қысқа (әдетте 2–5 сөйлем) жауап бер. Оқушыны кемсітпе, қатесін жұмсақ
түзет, жетістігін атап өт. Қауіпті әрекетке итермелеме және жеке дерек
сұрама. Оқушыдан аты-жөнін, мекенжайын, телефонын, мектебін немесе
құпия мәліметтерін сұрама.

ДЕРЕККӨЗ ЕРЕЖЕСІ:
Тек берілген STORY_KNOWLEDGE деректеріне сүйен. Оқиға, кейіпкер,
оқиға реті немесе деталь туралы жауап осы білім қорында болмаса,
ойдан қоспа. «Бұл мәлімет жүктелген мәтінде нақты көрсетілмеген» деп
айт. Басқа нұсқалармен араластырма. Мәтіндегі қайшылықты не түсініксіз
тұсты байқасаң, мұғаліммен тексеруді ұсын.
Ертегідегі қауіп/зорлық көріністерін 6-сыныпқа лайық бейтарап,
қысқаша баянда; егжей-тегжейлі суреттеме.
Оқушының жауабын тексергенде алдымен дұрыс тұсын атап, содан кейін
бір нақты кеңес бер. Дайын жауапты бірден бермей, қажет кезде ишара жаса.
`;

const knowledgeText = JSON.stringify(STORY_KNOWLEDGE);

export default async (req) => {
  const headers = { "Content-Type": "application/json; charset=utf-8" };
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Тек POST сұрауы қабылданады." }), { status: 405, headers });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  if (!apiKey || !model) {
    return new Response(JSON.stringify({
      error: "Netlify серверінде OPENAI_API_KEY және OPENAI_MODEL айнымалыларын орнату қажет."
    }), { status: 503, headers });
  }

  let body;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "Сұрау форматы қате." }), { status: 400, headers });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  const cleanMessages = messages
    .filter(m => m && ["user", "assistant"].includes(m.role) && typeof m.content === "string")
    .slice(-10)
    .map(m => ({ role: m.role, content: m.content.slice(0, 1200) }));

  if (!cleanMessages.length || cleanMessages[cleanMessages.length - 1].role !== "user") {
    return new Response(JSON.stringify({ error: "Алдымен сұрағыңды жаз." }), { status: 400, headers });
  }

  try {
    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        instructions: SYSTEM_PROMPT + "\n\nТЕКСЕРІЛГЕН ЕРТЕГІ БІЛІМ ҚОРЫ:\n" + knowledgeText,
        input: cleanMessages,
        max_output_tokens: 400
      })
    });
    const result = await upstream.json();
    if (!upstream.ok) {
      console.error("OpenAI API error:", upstream.status, result?.error?.type || "unknown");
      return new Response(JSON.stringify({ error: "ЖИ қызметінде уақытша қате болды. Кейінірек қайталап көр." }), { status: 502, headers });
    }
    const reply = (result.output_text || "").trim();
    if (!reply) throw new Error("Empty model response");
    return new Response(JSON.stringify({ reply }), { status: 200, headers });
  } catch (error) {
    console.error("Chat function error:", error.message);
    return new Response(JSON.stringify({ error: "Жауапты дайындау кезінде қате болды." }), { status: 500, headers });
  }
};
