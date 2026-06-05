# AF51 RBX ALX Integration

ALX is the canonical semantic gateway.

Flow:

Lua Input
↓
ALXRBXGateway
↓
LuaSemanticLayer
↓
RBXHierarchyLayer
↓
DeterminismLayer
↓
ValidationLayer
↓
ObjectGraphLayer
↓
ALXPipelineBridge
↓
RuntimePipelineOrchestrator

K1 contains canonical RBX runtime rules.