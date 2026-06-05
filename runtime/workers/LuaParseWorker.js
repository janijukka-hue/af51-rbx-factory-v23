export class LuaParseWorker {
  async run({ luaSource, parser }) {
    const ast = parser.parse(luaSource);

    return {
      success: true,
      ast
    };
  }
}