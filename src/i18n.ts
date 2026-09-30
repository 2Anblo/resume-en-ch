export type UiLang = 'zh' | 'en';

const dict = {
  zh: {
    tplEn: '英文简历', tplEnHint: "Jake's Resume（Overleaf 经典模板）",
    tplZh: '中文简历', tplZhHint: '简洁中文模板',
    download: '下载 PDF', importJson: '导入 JSON', exportJson: '导出 JSON', reset: '恢复示例',
    resetConfirm: '恢复为示例内容？当前模板的编辑内容会被覆盖（建议先导出 JSON 备份）。',
    importError: '无法读取该文件，请确认是本工具导出的 JSON。',
    pageSize: '纸张', template: '模板', basics: '基本信息', name: '姓名', headline: '求职意向 / 一句话介绍',
    photo: '照片（可选）', uploadPhoto: '上传照片', removePhoto: '移除照片',
    contacts: '联系方式', contactText: '显示文字', contactLink: '链接（可选）', addContact: '添加联系方式',
    sectionTitle: '模块标题', addEntry: '添加条目', addSkill: '添加一行',
    title: '标题', subtitle: '副标题', location: '地点', date: '时间',
    projTitle: '项目名称', projSubtitle: '技术栈',
    bullets: '要点（每行一条，**加粗**，[文字](链接)）',
    skillLabel: '类别', skillValue: '内容', text: '内容（每行一段）', table: '每行一行表格，单元格用 | 分隔，第一行是表头；不含 | 的行显示为普通文字',
    addSection: '添加模块', kinds: { entries: '经历（教育/工作）', projects: '项目', skills: '技能', text: '文本', table: '表格', exam: '报考信息' },
    examSchool: '报考院校', examMajor: '报考专业', examDirection: '研究方向（可选）', examScores: '初试成绩（总分会自动计算）', examSubject: '科目', examScore: '分数', examAddSubject: '添加科目',
    up: '上移', down: '下移', remove: '删除',
    printTip: '点击“下载 PDF”后，在打印窗口的目标打印机中选择“另存为 PDF”即可（若仍看到页眉页脚，取消勾选“页眉和页脚”）。',
    saved: '已自动保存到本浏览器', source: '开源代码',
  },
  en: {
    tplEn: 'English', tplEnHint: "Jake's Resume (classic Overleaf template)",
    tplZh: 'Chinese', tplZhHint: 'Clean Chinese template',
    download: 'Download PDF', importJson: 'Import JSON', exportJson: 'Export JSON', reset: 'Reset sample',
    resetConfirm: 'Reset to the sample? Your edits to this template will be replaced (export JSON first to keep a backup).',
    importError: 'Could not read this file. Is it a JSON exported from this app?',
    pageSize: 'Paper', template: 'Template', basics: 'Basics', name: 'Name', headline: 'Headline / target role',
    photo: 'Photo (optional)', uploadPhoto: 'Upload photo', removePhoto: 'Remove photo',
    contacts: 'Contact', contactText: 'Text', contactLink: 'Link (optional)', addContact: 'Add contact',
    sectionTitle: 'Section title', addEntry: 'Add entry', addSkill: 'Add line',
    title: 'Title', subtitle: 'Subtitle', location: 'Location', date: 'Dates',
    projTitle: 'Project name', projSubtitle: 'Tech stack',
    bullets: 'Bullets (one per line, **bold**, [text](url))',
    skillLabel: 'Category', skillValue: 'Items', text: 'Text (one paragraph per line)', table: 'One table row per line, cells separated by |, first row is the header; lines without | are plain text',
    addSection: 'Add section', kinds: { entries: 'Experience / Education', projects: 'Projects', skills: 'Skills', text: 'Text', table: 'Table', exam: 'Exam info (考研)' },
    examSchool: 'Target school', examMajor: 'Target major', examDirection: 'Research direction (optional)', examScores: 'Preliminary exam scores (total is computed)', examSubject: 'Subject', examScore: 'Score', examAddSubject: 'Add subject',
    up: 'Move up', down: 'Move down', remove: 'Delete',
    printTip: 'After clicking "Download PDF", pick "Save as PDF" as the destination (if you still see a header or footer, untick "Headers and footers").',
    saved: 'Saved in this browser automatically', source: 'Source',
  },
};

export type Dict = (typeof dict)['zh'];
export const t = (lang: UiLang): Dict => dict[lang];
