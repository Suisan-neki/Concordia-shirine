import { ENV } from "./env";
import { securityService } from "../security";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4" ;
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (
  part: MessageContent
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }

  if (part.type === "text") {
    return part;
  }

  if (part.type === "image_url") {
    return part;
  }

  if (part.type === "file_url") {
    return part;
  }

  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");

    return {
      role,
      name,
      tool_call_id,
      content,
    };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  // If there's only text content, collapse to a single string for compatibility
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text,
    };
  }

  return {
    role,
    name,
    content: contentParts,
  };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;

  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }

    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }

    return {
      type: "function",
      function: { name: tools[0].function.name },
    };
  }

  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name },
    };
  }

  return toolChoice;
};

const resolveApiUrl = () =>
  ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0
    ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`
    : "https://forge.manus.im/v1/chat/completions";

const assertApiKey = () => {
  if (!ENV.forgeApiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
};

const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (
      explicitFormat.type === "json_schema" &&
      !explicitFormat.json_schema?.schema
    ) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;

  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  assertApiKey();

  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
  } = params;

  // AI時代のセキュリティ対策: プロンプトインジェクション検出とサニタイズ
  const validatedMessages = await Promise.all(
    messages.map(async (msg) => {
      // ユーザーとアシスタントのメッセージのみ検証（システムメッセージは信頼）
      if (msg.role === 'user' || msg.role === 'assistant') {
        const content = typeof msg.content === 'string' 
          ? msg.content 
          : Array.isArray(msg.content)
            ? msg.content
                .filter((c): c is { type: 'text'; text: string } => 
                  typeof c === 'object' && 'type' in c && c.type === 'text')
                .map(c => c.text)
                .join(' ')
            : '';
        
        if (content) {
          const validation = await securityService.validateLLMInput(content);
          
          // 自動ブロックされた場合はエラーを投げる
          if (validation.blocked) {
            throw new Error('LLMリクエストがセキュリティ上の理由でブロックされました');
          }
          
          if (!validation.safe) {
            // 脅威が検出された場合は、サニタイズされたバージョンを使用
            if (typeof msg.content === 'string') {
              return { ...msg, content: validation.sanitized };
            } else if (Array.isArray(msg.content)) {
              return {
                ...msg,
                content: msg.content.map(c => 
                  typeof c === 'object' && 'type' in c && c.type === 'text'
                    ? { ...c, text: validation.sanitized }
                    : c
                ),
              };
            }
          }
        }
      }
      return msg;
    })
  );

  // AIサプライチェーン攻撃対策: 外部APIの検証
  const apiUrl = resolveApiUrl();
  const apiKey = ENV.forgeApiKey;
  const supplyChainValidation = await securityService.validateAISupplyChain(apiUrl, apiKey);
  if (!supplyChainValidation.safe) {
    console.warn('[LLM] AIサプライチェーンの検証に問題が検出されました:', supplyChainValidation.issues);
  }

  // AIガバナンス: LLMリクエストの記録
  await securityService.recordAIGovernanceEvent({
    type: 'llm_request',
    details: {
      model: 'gemini-2.5-flash',
      inputLength: JSON.stringify(validatedMessages).length,
    },
  });

  const payload: Record<string, unknown> = {
    model: "gemini-2.5-flash",
    messages: validatedMessages.map(normalizeMessage),
  };

  if (tools && tools.length > 0) {
    payload.tools = tools;
  }

  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }

  payload.max_tokens = 32768
  payload.thinking = {
    "budget_tokens": 128
  }

  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });

  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }

  const response = await fetch(resolveApiUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.forgeApiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`
    );
  }

  const result = (await response.json()) as InvokeResult;

  // AI時代のセキュリティ対策: 包括的な出力検証
  if (result.choices && result.choices.length > 0) {
    for (const choice of result.choices) {
      const content = typeof choice.message.content === 'string'
        ? choice.message.content
        : Array.isArray(choice.message.content)
          ? choice.message.content
              .filter((c): c is { type: 'text'; text: string } => 
                typeof c === 'object' && 'type' in c && c.type === 'text')
              .map(c => c.text)
              .join(' ')
          : '';
      
      if (content) {
        // 1. モデル反転攻撃対策: 機密情報の検出
        const sensitivePatterns = [
          /(api[_-]?key|apikey)\s*[:=]\s*['"]?[a-zA-Z0-9_-]{20,}['"]?/i,
          /(token|secret|password|passwd|pwd)\s*[:=]\s*['"]?[a-zA-Z0-9_-]{10,}['"]?/i,
          /(aws[_-]?access[_-]?key|aws[_-]?secret)/i,
          /(private[_-]?key|ssh[_-]?key)/i,
          /(bearer|basic)\s+[a-zA-Z0-9_-]{20,}/i,
        ];
        
        const hasSensitiveData = sensitivePatterns.some(pattern => pattern.test(content));
        if (hasSensitiveData) {
          await securityService.logSecurityEvent({
            eventType: 'llm_output_sensitive_data_detected',
            severity: 'warning',
            description: 'LLM出力に機密情報の可能性があるデータが検出されました',
            metadata: { contentLength: content.length },
            timestamp: Date.now(),
          }, true);
        }

        // 2. モデルポイズニング対策: レスポンスの信頼性検証
        const modelValidation = await securityService.validateModelResponse(
          { content, model: result.model, choices: result.choices },
          { minLength: 0, maxLength: 100000, allowedModels: ['gemini-2.5-flash'] }
        );
        if (!modelValidation.safe) {
          console.warn('[LLM] モデルレスポンスの検証に問題が検出されました:', modelValidation.issues);
        }

        // 3. メンバーシップ推論攻撃対策: 学習データの漏洩検出
        const membershipCheck = await securityService.detectMembershipInference(content);
        if (!membershipCheck.safe) {
          console.warn('[LLM] メンバーシップ推論攻撃の可能性が検出されました');
        }

        // 4. シャドウモデル対策: 出力の異常検知
        const expectedFormat = outputSchema || output_schema 
          ? { type: 'json' as const, schema: outputSchema?.schema || output_schema?.schema }
          : { type: 'text' as const };
        const shadowModelCheck = await securityService.detectShadowModel(content, expectedFormat);
        if (!shadowModelCheck.normal) {
          console.warn('[LLM] シャドウモデルの可能性が検出されました');
        }

        // 5. アライメント破壊対策: 安全制約の検証
        const alignmentCheck = await securityService.validateAlignment(content);
        if (!alignmentCheck.safe) {
          console.error('[LLM] アライメント破壊が検出されました:', alignmentCheck.violations);
        }

        // 6. 生成AIによるソーシャルエンジニアリング対策
        const socialEngineeringCheck = await securityService.detectSocialEngineering(content, 'text');
        if (!socialEngineeringCheck.safe) {
          console.warn('[LLM] ソーシャルエンジニアリングの可能性が検出されました:', socialEngineeringCheck.threats);
        }

        // 7. ベースライン比較: 正常な出力との統計的比較
        const baselineCheck = await securityService.compareWithBaseline(
          content,
          result.model,
          undefined, // userIdは後で追加可能
          undefined  // sessionIdは後で追加可能
        );
        if (!baselineCheck.normal) {
          console.warn('[LLM] ベースラインとの比較で異常が検出されました:', baselineCheck.anomalyScore);
        }

        // 8. AIガバナンス: LLMレスポンスの記録
        await securityService.recordAIGovernanceEvent({
          type: 'llm_response',
          details: {
            model: result.model,
            outputLength: content.length,
            tokensUsed: result.usage?.total_tokens,
          },
        });
      }
    }
  }

  return result;
}
