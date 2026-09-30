import type { Entry, Resume, Section, SectionKind } from './types';
import { uid } from './util';

export function entry(p: Partial<Entry> = {}): Entry {
  return { title: '', subtitle: '', location: '', date: '', bullets: '', ...p };
}

export function section(kind: SectionKind, title: string, p: Partial<Section> = {}): Section {
  return { id: uid(), kind, title, entries: [], skills: [], text: '', ...p };
}

/** Content from the sample in Jake Gutierrez's "Jake's Resume" template (MIT). */
export function sampleEn(): Resume {
  return {
    version: 1,
    lang: 'en',
    template: 'jake',
    name: 'Jake Ryan',
    headline: '',
    photo: '',
    pageSize: 'letter',
    contacts: [
      { text: '123-456-7890', link: '' },
      { text: 'jake@su.edu', link: 'mailto:jake@su.edu' },
      { text: 'linkedin.com/in/jake', link: 'https://linkedin.com/in/jake' },
      { text: 'github.com/jake', link: 'https://github.com/jake' },
    ],
    sections: [
      section('entries', 'Education', {
        entries: [
          entry({ title: 'Southwestern University', location: 'Georgetown, TX', subtitle: 'Bachelor of Arts in Computer Science, Minor in Business', date: 'Aug. 2018 – May 2021' }),
          entry({ title: 'Blinn College', location: 'Bryan, TX', subtitle: "Associate's in Liberal Arts", date: 'Aug. 2014 – May 2018' }),
        ],
      }),
      section('entries', 'Experience', {
        entries: [
          entry({
            title: 'Undergraduate Research Assistant', date: 'June 2020 – Present', subtitle: 'Texas A&M University', location: 'College Station, TX',
            bullets: [
              'Developed a REST API using FastAPI and PostgreSQL to store data from learning management systems',
              'Developed a full-stack web application using Flask, React, PostgreSQL and Docker to analyze GitHub data',
              'Explored ways to visualize GitHub collaboration in a classroom setting',
            ].join('\n'),
          }),
          entry({
            title: 'Information Technology Support Specialist', date: 'Sep. 2018 – Present', subtitle: 'Southwestern University', location: 'Georgetown, TX',
            bullets: [
              'Communicate with managers to set up campus computers used on campus',
              'Assess and troubleshoot computer problems brought by students, faculty and staff',
              'Maintain upkeep of computers, classroom equipment, and 200 printers across campus',
            ].join('\n'),
          }),
          entry({
            title: 'Artificial Intelligence Research Assistant', date: 'May 2019 – July 2019', subtitle: 'Southwestern University', location: 'Georgetown, TX',
            bullets: [
              'Explored methods to generate video game dungeons based off of **The Legend of Zelda**',
              'Developed a game in Java to test the generated dungeons',
              'Contributed 50K+ lines of code to an established codebase via Git',
              'Conducted a human subject study to determine which video game dungeon generation technique is enjoyable',
              'Wrote an 8-page paper and gave multiple presentations on-campus',
              'Presented virtually to the World Conference on Computational Intelligence',
            ].join('\n'),
          }),
        ],
      }),
      section('projects', 'Projects', {
        entries: [
          entry({
            title: 'Gitlytics', subtitle: 'Python, Flask, React, PostgreSQL, Docker', date: 'June 2020 – Present',
            bullets: [
              'Developed a full-stack web application using with Flask serving a REST API with React as the frontend',
              'Implemented GitHub OAuth to get data from user’s repositories',
              'Visualized GitHub data to show collaboration',
              'Used Celery and Redis for asynchronous tasks',
            ].join('\n'),
          }),
          entry({
            title: 'Simple Paintball', subtitle: 'Spigot API, Java, Maven, TravisCI, Git', date: 'May 2018 – May 2020',
            bullets: [
              'Developed a Minecraft server plugin to entertain kids during free time for a previous job',
              'Published plugin to websites gaining 2K+ downloads and an average 4.5/5-star review',
              'Implemented continuous delivery using TravisCI to build the plugin upon new a release',
              'Collaborated with Minecraft server administrators to suggest features and get feedback about the plugin',
            ].join('\n'),
          }),
        ],
      }),
      section('skills', 'Technical Skills', {
        skills: [
          { label: 'Languages', value: 'Java, Python, C/C++, SQL (Postgres), JavaScript, HTML/CSS, R' },
          { label: 'Frameworks', value: 'React, Node.js, Flask, JUnit, WordPress, Material-UI, FastAPI' },
          { label: 'Developer Tools', value: 'Git, Docker, TravisCI, Google Cloud Platform, VS Code, Visual Studio, PyCharm, IntelliJ, Eclipse' },
          { label: 'Libraries', value: 'pandas, NumPy, Matplotlib' },
        ],
      }),
    ],
  };
}

export function sampleZh(): Resume {
  return {
    version: 1,
    lang: 'zh',
    template: 'zh-simple',
    name: '张三',
    headline: '求职意向：后端开发工程师',
    photo: '',
    pageSize: 'a4',
    contacts: [
      { text: '138-0000-0000', link: '' },
      { text: 'zhangsan@example.com', link: 'mailto:zhangsan@example.com' },
      { text: 'github.com/zhangsan', link: 'https://github.com/zhangsan' },
      { text: '上海', link: '' },
    ],
    sections: [
      section('entries', '教育背景', {
        entries: [
          entry({ title: '复旦大学', subtitle: '计算机科学与技术 · 硕士', location: '上海', date: '2021.09 – 2024.06', bullets: '主修课程：分布式系统、数据库原理、机器学习\nGPA 3.8/4.0，获国家奖学金' }),
          entry({ title: '南京大学', subtitle: '软件工程 · 本科', location: '南京', date: '2017.09 – 2021.06' }),
        ],
      }),
      section('entries', '工作经历', {
        entries: [
          entry({
            title: '某互联网科技有限公司', subtitle: '后端开发工程师', location: '上海', date: '2024.07 – 至今',
            bullets: [
              '负责订单系统核心服务的设计与开发，日均处理请求 **2000 万+**',
              '主导缓存架构改造，引入多级缓存，接口 P99 延迟从 180ms 降至 **40ms**',
              '推动服务接入 CI/CD 流水线，发布效率提升 3 倍',
            ].join('\n'),
          }),
          entry({
            title: '某云计算公司', subtitle: '后端开发实习生', location: '杭州', date: '2023.06 – 2023.09',
            bullets: '参与对象存储元数据服务开发，完成分片迁移工具\n编写单元测试与压测脚本，覆盖率提升至 85%',
          }),
        ],
      }),
      section('projects', '项目经历', {
        entries: [
          entry({
            title: '开源中英文简历生成器', subtitle: 'TypeScript, Vite, GitHub Actions', date: '2024.03 – 2024.05',
            bullets: '在浏览器中编辑并实时预览简历，一键导出 PDF\n通过 GitHub Actions 自动构建并部署到 GitHub Pages',
          }),
        ],
      }),
      section('skills', '专业技能', {
        skills: [
          { label: '编程语言', value: 'Java、Go、Python、TypeScript、SQL' },
          { label: '框架与中间件', value: 'Spring Boot、gRPC、Redis、Kafka、MySQL' },
          { label: '工具', value: 'Git、Docker、Kubernetes、Linux' },
        ],
      }),
      section('text', '自我评价', {
        text: '热爱技术，关注系统稳定性与工程效率；具备良好的沟通能力与团队协作精神，乐于分享。',
      }),
    ],
  };
}

/** A filled-in 报考信息 section (院校 / 专业 / 初试成绩). */
export function examSection(): Pick<Section, 'entries' | 'skills'> {
  return {
    entries: [entry({ title: 'XXXX大学', subtitle: 'XXXX专业' })],
    skills: [
      { label: '政治', value: '70' },
      { label: '英语（一）', value: '75' },
      { label: '数学（一）', value: '120' },
      { label: '专业课', value: '125' },
    ],
  };
}

/** Content adapted from the sample in Kody's 中文考研复试简历模板 (MIT). */
export function sampleFushi(): Resume {
  return {
    version: 1,
    lang: 'zh',
    template: 'fushi',
    name: '姓 名',
    headline: '',
    photo: '',
    pageSize: 'a4',
    contacts: [
      { text: '出生年月：2003.01', link: '' },
      { text: '电话：138-0000-0000', link: '' },
      { text: '政治面貌：共青团员', link: '' },
      { text: '邮箱：your.email@example.com', link: '' },
    ],
    sections: [
      section('exam', '报考信息', examSection()),
      section('entries', '教育背景', {
        entries: [
          entry({
            title: '示例大学', subtitle: '金融工程', date: '2021.09 ~ 2025.06',
            bullets: '**GPA：**3.60/4.0　　**专业排名：**前 10%\n**主修课程：**数学分析、高等代数、概率论与数理统计、计量经济学、金融工程学等。',
          }),
        ],
      }),
      section('projects', '项目经历', {
        entries: [
          entry({
            title: '基于 GARCH-VaR 模型的白酒行业风险度量与风险预测', subtitle: '毕业设计', date: '2024.10 ~ 2025.03',
            bullets: [
              '**数据建模：**基于 2020–2023 年白酒行业 8 只股票数据，完成数据清洗与对数收益率构建，运用 Matlab 和 Stata 构建 GARCH 和 EGARCH 模型，通过最大似然估计求解参数并优化模型。',
              '**风险预测：**采用 VaR 方法在多置信水平下计算日度潜在损失，通过回测及 RMSE、MAE 指标验证模型，提出投资与风险预警建议。',
            ].join('\n'),
          }),
          entry({
            title: '基于优化算法的农作物种植策略研究（数学建模）', subtitle: '负责人', date: '2023.09',
            bullets: '**模型构建：**构建以利润最大化为目标的多约束优化模型，采用遗传算法求解，得出 2024–2030 年最优种植策略。\n**优化分析：**引入鲁棒优化与双目标建模，与基准模型对比，收益提升 15%。',
          }),
        ],
      }),
      section('entries', '实习经历', {
        entries: [
          entry({
            title: 'XX 银行 XX 支行', subtitle: '实习生', date: '2024.07 ~ 2024.08',
            bullets: '**客户服务：**协助大堂经理进行客户分流与接待，日均接待客户 80 余人，提高了网点运营效率与客户满意度。\n**运营支持：**负责单据整理、资料归档及信息录入，日均处理 100 份单据，录入准确率 100%。',
          }),
        ],
      }),
      section('entries', '校园经历', {
        entries: [
          entry({ title: '2021 级金融工程 1 班', subtitle: '团支书', date: '2021.09 ~ 2022.09', bullets: '**组织管理：**组织政治理论学习、主题团日和团课活动 8 次，推进班级凝聚力建设。' }),
          entry({ title: '校团委学生会', subtitle: '社团管理监督部干事', date: '2022.09 ~ 2023.09', bullets: '**活动管理：**跟进社团活动执行，监督流程与经费合规性；累计志愿服务时长 98 小时。' }),
        ],
      }),
      section('skills', '技能证书', {
        skills: [
          { label: '专业证书', value: 'CET-4、CET-6（495 分）、计算机二级 MS Office、普通话二级乙等。' },
          { label: '专业技能', value: 'Python、Matlab、SPSS；熟练使用 WPS、Office 等办公软件。' },
          { label: '在校荣誉', value: '全国大学生数学建模竞赛省级一等奖、优秀学生奖学金一等奖、优秀共青团员。' },
        ],
      }),
    ],
  };
}
