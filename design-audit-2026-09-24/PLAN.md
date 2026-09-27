# Cerebel AI 设计审查与优化计划

日期：2026-09-24。范围：现有首页、证据查看、基准比较、联系入口，以及四个相关产品与 Apple 的设计参考。本次交付为分析与计划，不是页面改版。

## 判断

现有网站有三个值得保留的资产：具有品牌辨识度的粒子人体、原始眼镜揭幕序列、可以亲自检查的真实动作数据。主要问题是这些资产之间的阅读路径过长，文字、工具栏与装饰标注多次抢在内容之前出现。

建议方向：**精密运动仪器的可信感 + Apple 产品页的留白和物体尺度 + SwiftUI 的状态连续性。** 黑、冷白、电紫继续作为核心色彩；增强焦点和节奏，不增加一套装饰特效。

## 证据范围与限制

- 读取了工作区的 App、导航、内容、基准组件和动效基础代码。
- 浏览了 cerebel.tech 公开版，以及由本机启动的已有构建预览 http://127.0.0.1:5180/。本地截图来自已有 dist 构建，不声称它是本次重新构建的完整源码产物。
- 公开版 Wearable 在 motion representation 后，本地已有构建与当前 App 的顺序是 Hero → Wearable → Evidence → Motion representation → Field → Company → Benchmark → Contact。优化以团队最新的 Wearable 紧随 Hero 决定为准。
- 本地桌面截图实际为 1280×720；公开版另外检查了约 741px 宽的紧凑布局。未完成真实手机、Safari、Firefox、触摸手势、读屏和低端设备性能测试。
- 实测本地文档高度约 13,920px，即 19.3 个 720px 视口。Wearable 3,096px，Company 2,161px，Benchmark 2,362px。这些是布局长度，不是访问时长或转化数据。
- 已验证 Benchmark 选择 NoShape 会联动详情，切换 SEQ 32 会更新对应数值；Joint motion 可进入并加载身体几何。静态预览中的视频首帧、提交接口和生产网络性能不作为已通过项目。
- 开发服务器启动遇到较长文件读取等待和依赖扫描错误，因此本次视觉审查使用已有构建，并与源码核对结构；不能据此判断生产站速度。

## 按访问路径审查

### 1. Hero — 有辨识度，焦点需收束（P1）

![本地 Hero](/Users/kaijunlin/Desktop/motionverse%20ai%20website/design-audit-2026-09-24/01-local-hero.png)

优点：黑场、大字、可辨识的人体给人明确记忆点；核心文案与两个行动入口完整。

问题：人体的手臂进入标题区域，粒子的亮度和文字接近；右侧操作提示极小且低对比。首屏 CTA、导航 CTA、底部 Evidence 大入口形成多重行动层级。保留巨大人体的空间感，但不应影响关键词阅读。

优化：保持当前标题及核心 copy；调整人体位置、亮度与构图，让标题后方形成安全阅读区。小脑 → 人体仍是唯一主交互。把操作说明收为一条清晰提示，聚焦或交互时再展开完整帮助。Evidence threshold 保留为清晰的直达入口，明确它会跳过 Wearable，而不是暗示自然下滚马上进入 Evidence。

### 2. Wearable — 内容方向对，进入证据的成本偏高（P1）

![本地眼镜揭幕](/Users/kaijunlin/Desktop/motionverse%20ai%20website/design-audit-2026-09-24/02-local-wearable.png)

优点：灰色影棚是全站难得的明度变化；原始产品序列值得保留。

问题：当前这一段约 4.3 屏，发生在真实重建证据之前。文字和镜架在左侧接近，产品物体边缘显得偏软；顶部深灰导航条也切断了影棚背景的完整性。单张截图无法判断全部帧的清晰度，应在实施时审查原始帧和绘制分辨率。

优化：保留全部 520 帧及现有原始素材，不启用 WearableStudio 实验。先尝试把滚动行程压缩到约 2.5–3 屏，仍需验证快速滚动下的可读性。透明、实体、内部结构对应三段清楚的解释节奏；标题避让镜架。保留显眼但克制的 development configuration 标注。导航随背景切换到清楚的中性状态。

### 3. Evidence — 证据强，画面到得太晚（P1）

![本地 Evidence 入口](/Users/kaijunlin/Desktop/motionverse%20ai%20website/design-audit-2026-09-24/02b-local-evidence.png)

优点：真实采集、日期、原始 paired composite 和 qualitative 说明构成扎实的信任基础。

问题：1280×720 下，进入章节后大半屏用于标题、段落和间距，只看到视频上部。重复的同步说明、模拟窗口交通灯、画面内标签共同增加 UI 层数。

优化：短标题和一行说明放在画面上方，让完整 paired composite 更早可见；内容来源、日期、定性证据说明合并成一条可读注释。保持一个原始 composite 播放器和原始比例，禁止拆为两个播放器。播放和暂停保持明确、可用的键盘操作。

### 4. Motion representation — 功能真实，入口像工具后台（P1）

![本地 motion 入口](/Users/kaijunlin/Desktop/motionverse%20ai%20website/design-audit-2026-09-24/03-local-motion.png)

![本地 Joint motion 已加载状态](/Users/kaijunlin/Desktop/motionverse%20ai%20website/design-audit-2026-09-24/03c-local-joint-motion.png)

优点：Surface / Joint motion 是互补视角，现有资料真实，已有四种活动。

问题：大标题、宽下拉框、帧率元数据、大号双模式标题把模型推到首屏以下。详细数据量与首次访问的需求不匹配。图像上当前 Joint motion 左侧视频区域是黑的；这是本地静态服务的观察，不能推断生产损坏。

优化：将模式选择收成紧凑的双段控制，舞台高度固定；让模型成为第一视觉。四项活动在桌面一行、手机 2×2 可见；保留已有手机改进。帧数、顶点、三角形等进入 Details。切换保持选中活动和时间位置，加载时保留真实第一帧；几何未就绪时不做伪同步。保留原视频、身体模型、轨迹和共用时间线，不重绘原始分析。不同视角避免模型比例和控件位置突然改变。

下方技术列表目前编号为 01/02/03/07，且末端带箭头但条目不是链接，会产生缺项和可点击的错觉。改成不编号的简洁描述，或完整、真实的可展开条目。

### 5. Benchmark — 比较有力量，呈现和口径应先修（P0）

![Benchmark 第一屏](/Users/kaijunlin/Desktop/motionverse%20ai%20website/design-audit-2026-09-24/04-local-benchmark.png)

![Benchmark 仪表](/Users/kaijunlin/Desktop/motionverse%20ai%20website/design-audit-2026-09-24/05-local-benchmark-instrument.png)

优点：T-head 从零开始的真实刻度、直接数值和方法联动比装饰图表更有说服力；NoShape 与 SEQ 切换已工作。

问题：Benchmark 位于 Company 之后，章节第一屏还未出现主图。方法、协议、模型参数、FLOPs 待核实被多次解释。四条轨道、侧边六轴雷达和说明同屏堆积，微型字过密。

口径问题：源码四个原始指标是 MPJPE、PA-MPJPE、GND、T-head。六轴雷达额外加入的 Cross-seq 来自两种序列长度的归一化 MPJPE 差；Precision 来自相对不确定度的再归一化。这两个是界面派生值，不是原始表的两个独立测量指标。建议优先改为四指标详情；若保留派生分析，必须独立标为 derived、解释公式及限制。不能为维持六轴外观让人误解测量证据。

GND 轨道的通用一位小数格式还会将 0.98 显示为 1.0，与 1.00 的差异被抹掉；应使用指标专属精度。来源表的 published 表述也应补齐实际可追溯来源与模型命名依据；无法链接正式来源时准确标明团队提供的评估材料。

优化：移到 Motion representation 后、Field 前；第一屏直接呈现“当前序列的结论 + T-head 主图 + SEQ 控件”。保留近黑全幅底色、真实零刻度、靛蓝 leader、电紫 selection。其它指标可选，精确值始终可见；完整表格和协议按需展开。50.45M 作为模型元数据只出现一次。

### 6. In the field — 真实关系是优势，文案应更自然（P1）

![Field 入口](/Users/kaijunlin/Desktop/motionverse%20ai%20website/design-audit-2026-09-24/06-local-field.png)

问题：又一次重复“大标题—说明—大间距—卡片”的节奏；“named partners appear only when they are real”像内部内容规范，不像写给客户的说明。

优化：保留 Overide 与 Apocynthion 的真实关系和外链，用合作对象、使用场景、Cerebel 的角色表达价值。运动内容用具备权利的真实照片或现有采集帧逐步替换原型图。不新增未经证明的成果数字。缩短引言，使案例本身先出现。

### 7. Company — 真实、有人味，适合作为节奏缓冲（P2）

![Company](/Users/kaijunlin/Desktop/motionverse%20ai%20website/design-audit-2026-09-24/07-local-company.png)

优点：真实实验室照片比概念科技图更可信，左右构图也比重复卡片成熟。

优化：保留 Lab → Prototype → Team 的单照片交叉淡化和 Team/Vision 的学校 provenance。缩短重复引导和过长停留；移动端继续使用 Team 锁定的正常文档流。学校不是客户 logo 墙。此部分优先级低于证据和首屏。

### 8. Contact — 可找到，表达与产品受众有落差（P1）

![Contact](/Users/kaijunlin/Desktop/motionverse%20ai%20website/design-audit-2026-09-24/08-local-contact.png)

问题：前面强调 athletes/coaching，但 Area of interest 中没有 Sports / Coaching。导航、Hero 的圆胶囊 CTA 与表单的直角矩形不一致。“Book a Demo”到达的是请求表单，而不是直接预约流程。

优化：加入 Sports / Coaching；统一按钮体系。统一采用 Request a Demo，或在表单清楚说明是提交需求后由团队联系，不能承诺未经确认的回复时限。必填项尽量少，错误就地显示、提交中不丢内容，成功后说明下一步。提交链路本次未测试。

## 参考网站：具体借什么

这些是相关类别与视觉参照，不代表所有产品都与 Cerebel 直接竞争。第三方自己的性能、客户和成果主张不迁移到 Cerebel。

| 来源 | 观察与借鉴 | 放到 Cerebel 哪里 |
| --- | --- | --- |
| [Apple AirPods Pro](https://www.apple.com/airpods-pro/) | 大比例单一产品、安静的背景、短而明确的主张；细节逐段进入，说明与物体有空间分工 | Wearable 构图、明暗节奏、产品素材清晰度 |
| [Apple Motion 指南](https://developer.apple.com/design/human-interface-guidelines/motion) | 动效支持状态和手势；短、准确、可取消；尊重减少动态效果 | 模式切换、按钮反馈、加载到完成的连续性 |
| [Move AI Accuracy](https://move.ai/accuracy) | 同一次动作的同步采集比较，并解释 how/who/what；主页也有直达 Accuracy | Evidence 与 Benchmark 的证据路径和来源说明 |
| [Theia](https://www.theiamarkerless.com/) | 用 Run / Throw / Flip 让用户按动作探索，并提供 validation 资料入口 | 四种活动的可见选择和清楚 active 状态；不照搬密集浮层卡片 |
| [Sportsbox AI](https://www.sportsbox.ai/) | 首屏真人挥杆和直接的运动任务；Measure → Goal → Practice → Progress 对用户结果的叙事明确 | Field 的动作语言与结果导向；不复制 AI 聊天、未经证实成效 |
| [Uplift](https://www.uplift.ai/solutions/sport-performance) | Capture → Analyze → Track progress 将技术翻译成教练流程 | 将“有哪些技术层”改写为“访客能看什么、能理解什么” |

![Apple 产品物体与留白](/Users/kaijunlin/Desktop/motionverse%20ai%20website/design-audit-2026-09-24/ref-apple-airpods.png)

![Move AI 比较说明](/Users/kaijunlin/Desktop/motionverse%20ai%20website/design-audit-2026-09-24/ref-move-accuracy.png)

![Sportsbox 动作首屏](/Users/kaijunlin/Desktop/motionverse%20ai%20website/design-audit-2026-09-24/ref-sportsbox.png)

设计判断：最适合的组合是 Apple 的构图和节奏、Move 的证据结构、Sportsbox 的动作语境；Theia/Uplift 提供任务清晰度的参考。无需整体复制任何一家。

## 第一阶段推荐结构

**Hero → 原始 Wearable → Evidence → Motion representation → Benchmark → In the field → Company → Contact。**

遵守 Wearable 紧随 Hero、Motion representation 紧随 Evidence 两项已定决策。导航和进度条与实际顺序统一；Benchmark 明确直达。Technology 可以更准确地标为 Motion representation 或 Motion，但需与最终命名统一。

第一阶段不同时进行全站拆页。后续若仍要缩短首页，可建立 Evidence / Technology / Company 的真实目的页，再迁移深层内容；不要恢复被删除的 Applications 章节或放空链接。

## 视觉与交互执行规格

- 标题仍然大胆，但不让每一章都用同样大小、相同留白开场；Hero 最大，Evidence/Benchmark 让内容和数据接管尺度，Company 更安静。
- 眼镜保留灰场，其它内容保留近黑和冷白。紫色表示行动与选中；Benchmark 靛蓝专门表示 leader。减少低对比紫色小字和无信息价值网格。
- 玻璃材质限于必要的浮动控制与导航；用光线、透明度和层级形成深度，避免每张内容卡都加 blur、描边和发光。
- 反馈建议初始目标：按压 100–160ms、选择态 180–260ms、同位置面板过渡 260–380ms、章节揭示 450–650ms。它们是本项目的调试起点，不是 Apple 官方固定参数。
- 按钮按压建议 scale 0.98；磁吸位移限制到约 2–4px、仅精细指针启用；手机用按压反馈。弹簧应充分阻尼，连续点击可打断并继续到最新状态。
- Surface / Joint motion 共享选择条、固定舞台和时间状态；不要用完整黑屏淡出掩盖加载，不把真实加载伪装成完成。第一帧预览可立即呈现，资源准备完成再接管。
- 原生页面滚动保留。粒子 stage 内保留已定的 wheel/drag/pinch/keyboard 行为，缩小到真实操作区域；区域外不拦截页面滚动或浏览器手势。
- 渲染循环不可见即暂停，DPR 封顶；减少动态效果时立即提供稳定内容。视频优先 metadata，尊重 Save-Data。避免全页同时运行多个重型画布。

## 实施顺序与验收

| 阶段 | 改动 | 完成标准 |
| --- | --- | --- |
| P0 证据与结构 | 修复雷达派生指标口径、GND 精度、来源说明；前移 Benchmark；导航顺序统一 | 原始四指标清晰；0.98 与 1.00 可区分；SEQ/方法/详情一致；所有导航落点正确 |
| P1 三段主体验 | Hero 焦点、Wearable 节奏、Evidence 与模型提前进入视野 | 1280×720 与 1440×900 下，主章节入口能看见核心内容；无标题遮挡；保留原始素材与指定顺序 |
| P1 连续交互 | 紧凑选项、共享状态、加载衔接、按钮统一 | 快速切换不闪空、不跳高、不丢活动；实际时间线同步；手机四活动始终可见 |
| P1 文案与联系 | 删除内部规范口吻、技术列表编号、补运动意向、清楚请求流程 | 没有假链接、假按钮、重复参数披露；表单错误/成功状态明确 |
| P2 内容与性能 | Field 真素材、Company 节奏、资源加载与跨设备 QA | 真实素材来源可确认；无后台无意义渲染；性能测试后再声明流畅度 |

最终检查：390/430/768/900/1280/1440px；键盘完整访问与焦点可见；200% 缩放；减少动态效果；慢网络与 Save-Data；Chrome/Safari/Firefox/Edge。验证手机 Joint motion 的静音 inline 播放、四活动切换、视频/身体/轨迹共用时间线。对小字与控件做实测对比度和触控尺寸检查，不能用截图代替完整可访问性验收。

性能目标可采用 LCP ≤ 2.5s、INP ≤ 200ms、CLS ≤ 0.1 的通行“良好”阈值，但本次未测得这些指标，也不承诺所有设备恒定 60fps。实施阶段应记录真实基线，再比较改变前后结果。

建议下一步：先完成 P0，并为 Hero → Wearable → Evidence 做一轮桌面与手机的视觉定稿，再进入动效实施；不要同时重写全站。
