# Motionverse 网站滚动深度审计

日期：2026-07-29  
范围：当前本地原型的桌面端与移动端，从 Hero 到 Demo 表单的完整下滑体验  
用户目标：让访问者在看到核心证据后，仍然愿意继续向下探索，并更快理解 Motionverse 是什么、为什么可信、适合谁

## 总结判断

这个网站的问题不是“视觉不够好”，也不只是“像素太长”。真正的问题是：

> 页面在最前面已经给出了最强的证据，但之后没有继续升级信息价值，而是用不同章节反复解释同一套概念。

Hero、同步重建证据、AMASS Benchmark 是目前最有吸引力的前三段。访问者看完 Benchmark 后，已经理解了大方向，也已经看到产品的可信度姿态。此时他们期待的是：

1. Motionverse 到底怎样工作；
2. 它能为我解决什么具体问题；
3. 我应该怎样开始合作。

当前页面却回到 “The data gap”，再依次解释 Capture、Understand、Structure、Technology、Wearable、Robotics、Applications、Partners、Company Vision。信息没有继续向前，而是在相近的名词之间绕圈。因此用户感受到的不是“内容丰富”，而是“还在说刚才那件事”。

## 量化证据

- 桌面端页面总高度约 **17,743px**，在当前 1280 × 720 视口中约为 **24.6 屏**。
- 移动端页面总高度约 **17,385px**，在 390 × 844 视口中约为 **20.6 屏**。
- 桌面端 “How Motionverse works” 单段约 **3,096px**，等于 **4.3 屏**；CSS 中直接使用了 `min-height: 430vh`。
- 通用 `.section` 在桌面端每段上下合计约 224–384px 留白；移动端固定为上下各 96px。
- 页面使用了约 9 次同一种 `SectionHeading` 结构：紫色 eyebrow、超大标题、一段灰色说明、较大的下方间距。
- 技术系统图在 Technology Stack 和 Wearable Platform 中重复使用同一个概念硬件资产。
- Robotics 同时拥有一个独立大章节，又是 Applications 中的默认第一个场景。
- Hero 中的核心品牌句在 Company Vision 尾部被完整重复。

这些数字说明：长度很大一部分来自章节模板、留白和重复结构，而不只是必要内容。

## 为什么越往下越不想看

### 1. 叙事高潮出现得太早，之后没有第二条上升曲线

Hero 建立愿景；Evidence 给出真实同步视频；Benchmark 给出专业、透明的评估姿态。这个顺序本身很好，也是当前最强的部分。

问题发生在 Benchmark 之后。页面没有从 “证明” 进入 “价值与行动”，而是退回 “问题背景与系统解释”。这相当于电影在高潮之后又重新解释世界观。

更自然的推进应该是：

**Promise → Proof → System → Consequence → Fit → Action**

而当前更接近：

**Promise → Proof → Proof → Problem again → Process → Technology → Similar process → Use case → Hardware again → Services → Vision again → Action**

### 2. 视觉形式重复，让新章节看起来像旧章节换了文案

以下多个章节都使用近似结构：

- 黑色或近黑背景；
- 左上角小号紫色 eyebrow；
- 左对齐超大白色标题；
- 一段灰色说明；
- 大面积留白；
- 下方横向列表、细线和编号。

单看每一屏都很精致，但连续看会产生模板感。用户在看到新标题前，已经凭布局判断“这又是一段类似说明”，于是不会期待惊喜。

Evidence 的双画面视频、Benchmark 的分析仪器、Robotics 的全幅真实场景、Company 的冷白反差，是少数真正改变页面语法的地方。页面需要更多这种“内容决定形式”的变化，而不是更多新的卡片或装饰。

### 3. 内容层面存在明显的概念重叠

几个章节实际上在回答相似的问题：

- Data Gap：为什么需要 Motionverse；
- How It Works：Capture → Understand → Structure → Deploy；
- Technology Stack：硬件、视觉、传感、重建、理解、同步、数据管线；
- Robotics：Human action → Body + hands → Object state → Action sequence；
- Wearable Platform：成像、IMU、PCB、计算、光学、模块化；
- Partner Solutions：产品定义、系统架构、传感器、PCB、AI、光学、原型、ODM、数据基础设施。

这些段落都在围绕“采集—理解—结构化—交付”和“硬件—感知—数据”展开。用户不会把它们理解为六个新观点，而会理解成同一观点被拆成了六段。

### 4. 滚动成本没有换来足够明显的变化

桌面端 How It Works 使用 430vh 的 sticky 叙事，但视觉主体始终是同一张图，只做缩放、变暗和状态标签变化。用户付出了 4.3 屏滚动，却没有获得 4.3 屏的信息增量。

这类 pinned storytelling 只有在每一步发生明显的结构变化时才值得：例如从 wearable RGB，切换到人体重建，再切换到手物关系，最后切换到时间序列输出。当前是“同一张图的四种解释”，回报不足。

### 5. 页面进度与导航没有帮助用户建立期待

右侧进度只显示 “当前编号 / 12”，但不告诉用户接下来是什么，也不解释为什么值得继续。

导航顺序是：

Technology → Evidence → Benchmark → Applications → Company

而真实页面顺序是：

Evidence → Benchmark → Data Gap → How It Works → Technology → Robotics → Applications → Platform → Partners → Company

导航与页面叙事不一致，尤其在移动端全屏菜单中，Technology 被编号为 01，但访问者实际下滑时先看到 Evidence。它削弱了空间感和章节预期。

### 6. 移动端不是更短，只是把相同内容重新堆叠

移动端约 20.6 屏，绝对高度与桌面端几乎一样。桌面端的横向结构在移动端变成纵向堆叠后，Data Gap、Technology Layers、Partner Capabilities 和 Demo Form 都会继续拉长。

移动端 How It Works 已取消 430vh sticky，这是正确的；但四个步骤、图像和说明仍然连续堆叠。移动端更需要内容合并，而不只是响应式换列。

## 当前体验中值得保留的部分

### Hero

品牌方向清晰，黑紫视觉有辨识度，核心 statement 易理解，两个 CTA 分工明确。Hero 已经建立了足够强的第一印象。

### Synchronized Evidence

真实配对视频是全站最有说服力的资产。它不是抽象品牌表达，而是可观察、可质疑、可验证的材料。应继续保持在 Hero 后第一位。

### AMASS Benchmark

Benchmark 是全站最强的“专业可信”章节。Bubble atlas、leader 标识、metric direction、source table 和 Motionverse withheld 状态共同表达了透明度。它值得保留为主要 wow moment。

### Applications

交互式场景切换是有意义的，因为不同 tab 确实改变了图像、任务和输出。它比独立列出多个行业段落更适合当前内容成熟度。

### Company 的冷白反差

冷白段落带来了急需的视觉换气。问题不是它的颜色，而是它承载的内容仍在重复 Hero。这个视觉断点可以保留，但应该成为更短、更有行动导向的转场。

## 章节逐段健康度

| 步骤 | 章节 | 健康度 | 判断 |
|---|---|---|---|
| 01 | Hero | 健康 | 承诺、品牌、CTA 清楚；可轻微压缩文案，但不应重做方向。 |
| 02 | Reconstruction Evidence | 健康 | 真实视频强；下方三张解释卡可压缩为视频内或视频下的一行说明。 |
| 03 | AMASS Benchmark | 强但偏长 | 核心交互应保留；顶部介绍、protocol strip、仪器和尾部状态目前跨越过多屏。 |
| 04 | Data Gap | 高度重复 | Hero 已表达相同问题；建议删除独立章节，只保留一句对比作为系统段入口。 |
| 05 | How Motionverse Works | 高风险 | 430vh 是最大的滚动负担；同一张图变化不足以支撑四屏 sticky。 |
| 06 | Technology Stack | 中等 | 内容重要，但与 How It Works 和 Platform 重叠；应合并成一个系统剖面。 |
| 07 | Robotics | 中等 | 全幅图有变化，但内容又在 Applications 中出现；建议并入 Applications。 |
| 08 | Applications | 健康 | 交互真正改变内容，是值得继续下滑的段落。 |
| 09 | Wearable Platform | 重复 | 与 Technology 使用同一图和相近能力；建议合并，不再单独占一章。 |
| 10 | Partner Solutions | 定位风险 | 9 项服务把产品叙事突然扩大到 ODM/产品开发服务；建议压缩为两种合作路径。 |
| 11 | Company Vision | 视觉健康、内容重复 | 冷白反差有效，但文案重复 Hero；应改成一句 conviction + CTA 转场。 |
| 12 | Demo | 健康 | 表单清楚；若前文更短，用户更有可能真正到达这里。 |
| 13 | Mobile Menu | 中等 | 全屏菜单设计成熟，但顺序与真实页面不一致；需要跟随新信息架构重新编号。 |

## 推荐的新页面结构

建议从 12 个进度章节缩成 6 个。

### 01 — Hero / 一句话承诺

保留现有方向。把 Hero 控制在 0.9–1.0 屏。继续使用：

- 核心品牌句；
- Book a Demo；
- See the Proof；
- 自然佩戴设备的真实动作视觉。

### 02 — Proof / 一个连续证据章节

把 Evidence 与 Benchmark 视为一个章节中的两个证据层级：

1. **Qualitative evidence**：同一动作、同一时间线、wearable 与 reconstruction；
2. **Evaluation discipline**：AMASS published field + Motionverse evaluation status。

两者之间用一句明确桥接：

> A synchronized demo shows what the system recovers. A locked protocol shows how recovery should be judged.

这样 Benchmark 不再像第二个独立 landing page，而是证据逻辑的升级。

### 03 — The System / 合并四个章节

合并：

- Data Gap；
- How It Works；
- Technology Stack；
- Wearable Platform。

只保留三步：

1. Capture naturally；
2. Reconstruct body, hands, objects；
3. Deliver synchronized temporal data。

视觉上不要再使用 430vh 同图 sticky。更好的形式是一个真实“系统剖面”：

- 左侧：概念设备 / capture configuration；
- 中间：同步时间线；
- 右侧：body + hand + interaction output；
- 点击三步时，系统剖面发生真正的内容切换。

桌面端控制在 1.5–2 屏；移动端使用三个紧凑的连续场景。

### 04 — Where It Matters / 一个应用章节

保留 Applications tab，删除独立 Robotics 章节。四个场景足够：

- Robotics；
- Industrial；
- Sports；
- Research + Digital Humans。

每个场景只回答：

- Captured context；
- Structured output；
- Why it matters。

不要再重复完整的系统原理。

### 05 — Ways to Work Together / 两条合作路径

将 9 项 Partner Capabilities 收拢成两条：

1. **Motion data / research collaboration**
2. **Wearable system / product integration**

每条只列 3 个最关键能力，并给出对应 CTA。这样既保留商业覆盖面，又不让用户误以为 Motionverse 是一家通用 ODM 服务公司。

### 06 — Conviction + Demo / 一个结尾

保留冷白作为视觉换气，但压缩为 0.5 屏的 closing statement，然后直接进入 demo form。

不要再次完整重复 Hero。可以将结尾写成：

> Human motion should be as legible to machines as language and images.

然后进入：

> Tell us what you need to capture.

## 目标长度

建议的第一阶段目标：

- 桌面端：从约 17,743px 降到 **9,000–10,500px**；
- 移动端：控制在约 **10–13 屏**；
- 主进度章节：从 12 个降到 **6 个**；
- How It Works：从 430vh 降到 **120–160vh 上限**，或彻底取消 scroll-driven sticky；
- Standard section 的上下留白减少约 25–35%，但不要平均压缩所有段落，应优先删除重复章节。

重点不是把每段都变矮，而是让每一段拥有不同的任务和明显的新信息。

## 视觉节奏原则

新的页面应该有六种不同的“章节语法”，而不是六次同一个模板：

1. Hero：cinematic promise；
2. Evidence：synchronized media；
3. Benchmark：analytical instrument；
4. System：spatial cutaway / timeline；
5. Applications：editorial interactive cases；
6. Closing：quiet contrast + action。

每个章节只回答一个问题，并在结尾打开下一个问题：

- “真的能恢复吗？” → Evidence；
- “如何客观判断？” → Benchmark；
- “系统如何做到？” → System；
- “对谁有用？” → Applications；
- “如何一起做？” → Partnership / Demo。

这会比增加动效、3D 装饰或更多卡片更有效。

## 可访问性风险

从截图与代码可以确认或高度怀疑的风险：

- 多处 mono 微文案低至约 0.48–0.62rem，在深色背景上对比偏低；Benchmark 和技术标注最明显。
- 非激活的 process steps 主要依靠极低亮度和紫色状态来区分，阅读成本高。
- 长距离 scroll-driven sticky 对部分用户会产生疲劳；当前 reduced-motion 样式会取消 sticky，这是一个明确优点。
- 移动菜单有 dialog、Escape 和 autofocus，但尚未从本次截图确认完整 focus trap 与关闭后的焦点恢复。
- 截图不能证明键盘顺序、屏幕阅读器语义或所有对比度是否达到 WCAG；这些需要单独交互测试。

## 优先级

### P0 — 先解决结构

- 删除独立 Data Gap；
- 合并 How It Works + Technology + Platform；
- 删除独立 Robotics；
- 压缩 Partner Solutions；
- 合并 Company Vision 与 Demo 前的 closing。

### P1 — 再解决节奏

- 重新设计 6 段式进度；
- 让导航顺序与真实页面顺序一致；
- 为每一章采用不同的内容驱动版式；
- 在章节之间加入明确的逻辑桥接，而不是只靠留白。

### P2 — 最后处理细节

- 缩短 intro copy；
- 提高小号标注对比和字号；
- 减少不必要的 section padding；
- 校准移动端 tab、列表和表单的密度；
- 检查 focus trap、焦点恢复与键盘状态。

## 审计证据

本次截图保存在：

`screenshots/audit-2026-07-29-depth/`

其中包括 17 张桌面滚动截图与 5 张移动端截图，覆盖 Hero、Evidence、Benchmark、Data Gap、How It Works、Technology、Robotics、Applications、Platform、Partners、Company、Demo 和 Mobile Menu。

## 证据限制

本次审计基于本地构建的当前视觉与交互状态。它没有使用真实用户行为数据，因此不能证明用户具体在哪一屏流失；“流失点”是根据滚动长度、信息重复、视觉节奏和交互成本作出的设计推断。建议在重构后增加 section-view 与 CTA click 分析，验证 Evidence、Benchmark、Applications 和 Demo 的到达率变化。
