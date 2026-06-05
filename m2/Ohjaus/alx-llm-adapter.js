// m2/Ohjaus/alx-llm-adapter.js
// ALX LLM Adapter - Anthropic Claude API integration

export class ALXLLMAdapter {
  constructor(options = {}) {
    this._clock = options.clock;
    this._apiKey = options.apiKey || null;
    this._model = options.model || "claude-sonnet-4-20250514";
    this._baseUrl = "https://api.anthropic.com/v1/messages";
    this._maxTokens = options.maxTokens || 2048;
    this._systemPrompt = options.systemPrompt || this._defaultSystemPrompt();
  }

  _defaultSystemPrompt() {
    return `Olet ALX, Jani Segermanin henkilökohtainen tekoälyavustaja ja mestari-AL.

Erikoisalueesi:
- JavaScript/TypeScript ja React Native kehitys
- T3 Factory build-järjestelmä
- AL-olioiden (Autonomous Learner) hallinta
- Suomenkielinen viestintä

Vastaa aina suomeksi ellei toisin pyydetä. Ole ytimekäs ja käytännöllinen.
Kun generoit koodia, käytä JavaScript-syntaksia (ei TypeScript ellei pyydetä).
Noudata deterministisiä periaatteita - ei Date.now() tai Math.random() suoraan.`;
  }

  setApiKey(key) {
    this._apiKey = key;
  }

  hasApiKey() {
    return !!this._apiKey;
  }

  async chat(messages, options = {}) {
    if (!this._apiKey) {
      return {
        ok: false,
        error: "API-avain puuttuu. Aseta se ensin.",
        text: null
      };
    }

    const formattedMessages = messages.map(m => ({
      role: m.role === "alx" ? "assistant" : m.role,
      content: m.content || m.text
    }));

    try {
      const response = await fetch(this._baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this._apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: this._model,
          max_tokens: options.maxTokens || this._maxTokens,
          system: options.systemPrompt || this._systemPrompt,
          messages: formattedMessages
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          ok: false,
          error: errorData.error?.message || `API virhe: ${response.status}`,
          text: null
        };
      }

      const data = await response.json();
      const text = data.content?.[0]?.text || "";

      return {
        ok: true,
        text,
        usage: data.usage,
        model: data.model
      };

    } catch (err) {
      return {
        ok: false,
        error: `Verkkovirhe: ${err.message}`,
        text: null
      };
    }
  }

  async generateCode(prompt, context = {}) {
    const codePrompt = `Generoi koodi seuraavaan tarpeeseen:

${prompt}

${context.language ? `Kieli: ${context.language}` : ""}
${context.framework ? `Framework: ${context.framework}` : ""}

Vastaa VAIN koodilla, ei selityksiä. Käytä \`\`\`javascript ... \`\`\` blokkia.`;

    const result = await this.chat([{ role: "user", content: codePrompt }]);

    if (!result.ok) return result;

    const codeMatch = result.text.match(/```(?:javascript|js|typescript|ts)?\n([\s\S]*?)```/);
    const code = codeMatch ? codeMatch[1].trim() : result.text;

    return {
      ok: true,
      code,
      fullResponse: result.text
    };
  }

  async analyzeAndSuggest(code, question) {
    const prompt = `Analysoi tämä koodi ja vastaa kysymykseen.

KOODI:
\`\`\`javascript
${code}
\`\`\`

KYSYMYS: ${question}`;

    return await this.chat([{ role: "user", content: prompt }]);
  }

  async refactorCode(code, instructions) {
    const prompt = `Refaktoroi tämä koodi ohjeiden mukaan.

KOODI:
\`\`\`javascript
${code}
\`\`\`

OHJEET: ${instructions}

Vastaa refaktoroidulla koodilla \`\`\`javascript ... \`\`\` blokissa.`;

    const result = await this.chat([{ role: "user", content: prompt }]);

    if (!result.ok) return result;

    const codeMatch = result.text.match(/```(?:javascript|js)?\n([\s\S]*?)```/);
    const refactoredCode = codeMatch ? codeMatch[1].trim() : null;

    return {
      ok: true,
      code: refactoredCode,
      explanation: result.text
    };
  }
}

export function createALXLLMAdapter(options) {
  return new ALXLLMAdapter(options);
}

export default ALXLLMAdapter;