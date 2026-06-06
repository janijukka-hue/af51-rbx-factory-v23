# AF51-RBX Factory v23 🚀

**Enterprise Roblox Code Factory with 150-Skill Capability Operating System**

---

## 🎯 What is this?

AF51-RBX Factory is a production-grade Roblox development factory that transforms Lua source code into complete, deployable Roblox experiences. It features:

- **150 AI Skills** across 12 enterprise domains (Analysis, Creation, Design, Production, Runtime, Governance, Intelligence, Evolution, Security, Business, Integration, Learning)
- **K1 Ring Architecture** - Enterprise capability operating system
- **Real-time 3D Preview** with intelligent camera framing
- **Code-Aware Analysis** - Understands game type, quality, and design patterns
- **Full Production Pipeline** - Build → Analyze → Preview → Export → Deploy

---

## 📦 Download Complete Project

**[⬇ DOWNLOAD PROJECT ZIP](http://localhost:3000/download-project)**

Or access via API:
```bash
curl http://localhost:3000/download-project -o af51-rbx-factory-complete.zip
```

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Backend Server
```bash
npm run server
```

### 3. Start Frontend UI
```bash
npx expo start --web --clear
```

### 4. Open Cockpit
Navigate to: `http://localhost:8081` (or port shown in Expo output)

Click **"Cockpit"** tab to access the Production Cockpit.

---

## 🎨 Features

### **150-Skill Enterprise Ring**
- **Analysis (14 skills)**: Game-type detection, sentiment analysis, complexity measurement
- **Creation (14 skills)**: Vehicles, lighting, sound, effects, physics, animation
- **Design (14 skills)**: Composition, color theory, style analysis, aesthetics
- **Production (14 skills)**: Build pipeline, CI/CD, testing, deployment, monitoring
- **Runtime (12 skills)**: Performance optimization, memory management, networking
- **Governance (12 skills)**: Audit trails, compliance, policy enforcement
- **Intelligence (12 skills)**: AI reasoning, decision-making, NLP, computer vision
- **Evolution (12 skills)**: A/B testing, optimization, chaos engineering
- **Security (10 skills)**: Encryption, authentication, threat detection
- **Business (10 skills)**: Market analysis, monetization, growth analytics
- **Integration (10 skills)**: API connectors, webhooks, ETL pipelines
- **Learning (10 skills)**: Feedback loops, pattern recognition, reinforcement learning

### **Production Cockpit**
- Write Lua → See Live 3D Preview
- Real-time semantic analysis
- Intelligent camera framing (hero detection)
- Quality gate scoring (0-100)
- Design reports across 6 dimensions
- One-click ZIP export

### **Code-Aware Factory**
- Detects game type (Obby, Tycoon, RPG, Simulator, FPS, Racing, etc.)
- Analyzes vehicle composition and quality
- Evaluates architectural patterns
- Measures performance and mobile-readiness
- Generates production-ready manifests

---

## 📂 Project Structure

```
af51-rbx-factory-v23/
├── k1/                     # K1 Ring Architecture (Capability OS)
│   ├── SkillsRing.mjs     # Skills registry & execution
│   ├── SkillsRingGovernor.mjs  # Orchestration & learning
│   └── SkillsRingBootstrap.mjs # 150 skill registration
├── s4/                     # S4 Layer (UI & Screens)
│   ├── screens/Cockpit/   # Production Cockpit UI
│   ├── oliot/rbx-skills/  # 150 individual skill classes
│   └── theme/             # Design system
├── runtime/                # Runtime engines
│   ├── rbx-runtime/       # Roblox build pipeline
│   └── preview-engine/    # 3D preview renderer
├── server.js              # Main backend server
└── App.js                 # React Native Expo app

```

---

## 🛠 API Endpoints

### Core Build
- `POST /rbx/lua-build` - Build from Lua source (returns preview + ZIP)
- `POST /rbx/build` - Build from target prompt (obby/tycoon/rpg/fps/simulator)

### Skills Ring
- `POST /skills/analyze` - Analyze scene graph with Skills Ring
- `GET /skills/status` - Skills Ring health & statistics

### Download
- `GET /download-project` - Download entire project as ZIP
- `GET /rbx/download/:zipName` - Download specific build ZIP

---

## 🎓 Usage Examples

### Build an Obby
```lua
local obby = Instance.new("Model")
obby.Name = "MegaObby"

for i = 1, 10 do
  local stage = Instance.new("Part")
  stage.Size = Vector3.new(20, 1, 20)
  stage.Position = Vector3.new(0, i * 10, 0)
  stage.BrickColor = BrickColor.new("Bright blue")
  stage.Parent = obby
end

obby.Parent = workspace
```

Paste into Cockpit → Click **RUN** → See live 3D preview + analysis

---

## 📊 Skills Ring Output Example

```json
{
  "intent": "obby",
  "confidence": "high",
  "quality": {
    "overall": 72,
    "tier": "T2",
    "ready": true
  },
  "vehicle": null,
  "composition": {
    "hero": "MegaObby",
    "hierarchy": "vertical-progression"
  },
  "performance": {
    "estimatedFps": 60,
    "mobileReady": "excellent"
  }
}
```

---

## 🔧 Configuration

Environment variables (optional):
```bash
PORT=3000                    # Backend server port
ALX_CORS_ORIGIN=*           # CORS origin
NODE_ENV=development        # Environment
```

---

## 🏗 Architecture Highlights

### K1 Ring System
The K1 layer implements an **Enterprise Capability Operating System**:
- Skills Registry (150 skills)
- Governor (dependency resolution, orchestration)
- Energy Ring (performance throttling)
- Audit Trail (full governance)
- Learning Engine (trust scores, adaptation)

### Governor Intelligence
The Skills Ring Governor automatically:
- Resolves skill dependencies (topological sort)
- Selects optimal skill pipeline for each intent
- Tracks energy costs and performance
- Learns from execution history (trust scores)
- Enforces quality gates

---

## 📈 Performance

- **Build Time**: ~50-100ms (typical Lua scene)
- **Skills Ring Analysis**: ~1.5ms (4-8 skills executed)
- **3D Preview**: Real-time 60fps
- **ZIP Generation**: <200ms

---

## 🎯 What's Next?

The 150-skill foundation enables:
- Multi-domain orchestration (cross-skill workflows)
- Advanced evolution pipelines (A/B testing, optimization)
- Business intelligence (market analysis, growth metrics)
- Security hardening (threat detection, encryption)
- Integration ecosystem (webhooks, ETL, external APIs)

---

## 🚀 Production Ready

✅ 150/150 Skills Complete  
✅ 12/12 Domains Active  
✅ Full End-to-End Integration  
✅ Live UI (Cockpit + Preview)  
✅ Build Pipeline (Parse → Analyze → Export)  
✅ Quality Gates (0-100 scoring)  
✅ Governor Orchestration  
✅ Learning & Adaptation  

---

**Built with:** React Native (Expo), Node.js, Express, Archiver, Luaparse

**License:** Proprietary

**Version:** v23 (Enterprise Skills Ring v1.0)

---

🎉 **Homma paketissa!** 🚀
