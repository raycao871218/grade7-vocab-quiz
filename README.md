# 七年级英语词汇摸底

一个给小朋友做新版人教版七年级英语词汇摸底的小前端项目。

## 功能

- 从环境变量 `VOCAB_SOURCE_PATH` 指定的词表文件读取单词。
- 支持 Obsidian Markdown 词表，自动读取 `## 完整表` 和 `## 加测 20 个`。
- 三种练习模式：英译中选择、看中文拼英文、拼写听写式自测。
- 记录正确率、进度和错题。

## 启动

```bash
cp .env.example .env
npm install
npm run dev
```

打开终端里显示的本地地址。

## 词表路径

在 `.env` 中修改：

```bash
VOCAB_SOURCE_PATH=/absolute/path/to/vocab.md
```

路径必须是本机绝对路径。浏览器不能直接读取本地任意文件，本项目通过 Vite 本地开发服务器读取词表并提供给前端。
