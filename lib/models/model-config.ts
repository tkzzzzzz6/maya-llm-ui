/**
 * 模型获取配置
 *
 * 设置为 true 将从 API 动态获取最新模型列表
 * 设置为 false 将使用代码中的静态模型列表
 */
export const MODEL_FETCH_CONFIG = {
  /**
   * 是否启用动态模型获取
   *
   * 优点：
   * - 自动获取最新模型，无需手动更新代码
   * - 始终显示提供商的所有可用模型
   *
   * 缺点：
   * - 首次加载可能稍慢
   * - 需要有效的 API Key
   * - 依赖提供商的 API 可用性
   *
   * 如果动态获取失败，会自动回退到静态模型列表
   */
  useDynamicFetch: true,

  /**
   * 为每个提供商单独配置
   */
  providers: {
    google: true, // 启用 Google Gemini 动态获取
    openai: true, // 启用 OpenAI 动态获取
    anthropic: true, // 启用 Anthropic Claude 动态获取
    openrouter: true, // OpenRouter 默认就是动态的
    ollama: true // Ollama 默认就是动态的
  }
}
