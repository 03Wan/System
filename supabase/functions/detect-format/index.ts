import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";
import { DOMParser } from "https://esm.sh/@xmldom/xmldom@0.8.10";

type Severity = "ERROR" | "WARNING" | "INFO";
type IssueStatus = "confirmed" | "suspected" | "manual_review";

type RuleRow = {
  rule_code: string;
  severity: Severity;
  rule_config: Record<string, unknown> | null;
};

type Issue = {
  problem_type: string;
  problem_desc: string;
  position: string;
  severity: Severity;
  suggestion: string;
  confidence: number;
  issue_status: IssueStatus;
  auto_fix: boolean;
  reasons: string[];
};

type RunInfo = {
  text: string;
  font: string | null;
  sizeHalfPt: number | null;
  bold: boolean | null;
};

type ParagraphInfo = {
  index: number;
  text: string;
  styleId: string;
  align: string | null;
  lineTwips: number | null;
  firstIndentTwips: number | null;
  spaceBeforePt: number | null;
  spaceAfterPt: number | null;
  numId: number | null;
  ilvl: number | null;
  inTable: boolean;
  hasDrawing: boolean;
  hasTocField: boolean;
  hasPageField: boolean;
  runs: RunInfo[];
};

type SectionInfo = {
  pageWidthTwips: number | null;
  pageHeightTwips: number | null;
  marginTopTwips: number | null;
  marginBottomTwips: number | null;
  marginLeftTwips: number | null;
  marginRightTwips: number | null;
  headerRefs: number;
  footerRefs: number;
};

type DocInfo = {
  paragraphs: ParagraphInfo[];
  sections: SectionInfo[];
  hasPageField: boolean;
  hasTocField: boolean;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const headingKeywordMap = {
  abstractZh: ["摘要"],
  abstractEn: ["abstract"],
  conclusion: ["结论", "结束语", "conclusion"],
  thanks: ["致谢", "acknowledgement", "acknowledgment"],
  reference: ["参考文献", "references"],
  appendix: ["附录", "appendix"],
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function localNameOf(el: Element): string {
  const raw = (el.localName || el.tagName || (el as unknown as { nodeName?: string }).nodeName || "").toLowerCase();
  if (raw.includes(":")) return raw.split(":").pop() || raw;
  return raw;
}

function elementChildren(node: Element): Element[] {
  const rawChildren = (node as unknown as { children?: unknown[] }).children;
  if (Array.isArray(rawChildren)) return rawChildren as Element[];
  const childNodes = (node as unknown as { childNodes?: ArrayLike<unknown> }).childNodes;
  if (!childNodes) return [];
  const out: Element[] = [];
  for (let i = 0; i < childNodes.length; i += 1) {
    const n = childNodes[i] as { nodeType?: number };
    if (n && n.nodeType === 1) out.push(childNodes[i] as Element);
  }
  return out;
}

function attr(node: Element | null, key: string): string {
  if (!node) return "";
  return (
    node.getAttribute(`w:${key}`) ||
    node.getAttribute(key) ||
    node.getAttributeNS("http://schemas.openxmlformats.org/wordprocessingml/2006/main", key) ||
    ""
  ).trim();
}

function firstChildByLocalName(node: Element, name: string): Element | null {
  for (const child of elementChildren(node)) {
    if (localNameOf(child) === name) return child;
  }
  return null;
}

function childrenByLocalName(node: Element, name: string): Element[] {
  const out: Element[] = [];
  for (const child of elementChildren(node)) {
    if (localNameOf(child) === name) out.push(child);
  }
  return out;
}

function descendantsByLocalName(node: Element, name: string): Element[] {
  return Array.from(node.getElementsByTagName("*")).filter((el) => localNameOf(el) === name);
}

function hasAncestorWithLocalName(node: Element, name: string): boolean {
  let cur: Element | null = ((node as unknown as { parentElement?: Element; parentNode?: Element }).parentElement ||
    (node as unknown as { parentNode?: Element }).parentNode ||
    null) as Element | null;
  while (cur) {
    if (localNameOf(cur) === name) return true;
    cur = ((cur as unknown as { parentElement?: Element; parentNode?: Element }).parentElement ||
      (cur as unknown as { parentNode?: Element }).parentNode ||
      null) as Element | null;
  }
  return false;
}

function parseNumber(value: string): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeText(input: string): string {
  return String(input || "").replace(/\s+/g, " ").trim();
}

function toPreview(text: string): string {
  const t = normalizeText(text);
  return t.length <= 16 ? t : `${t.slice(0, 16)}...`;
}

function toAsciiLower(input: string): string {
  return String(input || "").toLowerCase();
}

function cmToTwips(cm: number): number {
  return cm * 567;
}

function ptToHalfPt(pt: number): number {
  return pt * 2;
}

function lineSpacingToTwips(multiplier: number): number {
  return multiplier * 240;
}

function between(value: number | null, expected: number, tolerance: number): boolean {
  if (value === null) return false;
  return Math.abs(value - expected) <= tolerance;
}

function parseYesNoLike(value: unknown, defaultValue: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (["1", "true", "yes", "y"].includes(v)) return true;
    if (["0", "false", "no", "n"].includes(v)) return false;
  }
  return defaultValue;
}

function findRule(rules: RuleRow[], code: string): RuleRow | undefined {
  return rules.find((r) => String(r.rule_code || "").toUpperCase() === code.toUpperCase());
}

function hasRule(rules: RuleRow[], code: string): boolean {
  return !!findRule(rules, code);
}

function ruleConfig(rules: RuleRow[], code: string): Record<string, unknown> {
  return (findRule(rules, code)?.rule_config || {}) as Record<string, unknown>;
}

function ruleSeverity(rules: RuleRow[], code: string, fallback: Severity): Severity {
  return findRule(rules, code)?.severity || fallback;
}

function makeIssue(params: {
  problemType: string;
  problemDesc: string;
  position: string;
  suggestion: string;
  severity: Severity;
  confidence?: number;
  issueStatus?: IssueStatus;
  autoFix?: boolean;
  reasons?: string[];
}): Issue {
  return {
    problem_type: params.problemType,
    problem_desc: params.problemDesc,
    position: params.position,
    severity: params.severity,
    suggestion: params.suggestion,
    confidence: params.confidence ?? 0.9,
    issue_status: params.issueStatus ?? "confirmed",
    auto_fix: params.autoFix ?? true,
    reasons: params.reasons ?? ["matched_style_name"],
  };
}

function parseDocx(documentXml: string, stylesXml: string | null): DocInfo {
  const parser = new DOMParser();
  const doc = parser.parseFromString(documentXml, "application/xml");
  const stylesDoc = stylesXml ? parser.parseFromString(stylesXml, "application/xml") : null;

  let defaultFont: string | null = null;
  let defaultSizeHalfPt: number | null = null;
  let defaultLineTwips: number | null = null;
  let defaultFirstIndentTwips: number | null = null;
  let defaultSpaceBeforePt: number | null = null;
  let defaultSpaceAfterPt: number | null = null;

  if (stylesDoc?.documentElement) {
    const docDefaults = descendantsByLocalName(stylesDoc.documentElement, "docdefaults")[0];
    const rPrDefault = docDefaults ? descendantsByLocalName(docDefaults, "rprdefault")[0] : null;
    const pPrDefault = docDefaults ? descendantsByLocalName(docDefaults, "pprdefault")[0] : null;
    const rPr = rPrDefault ? descendantsByLocalName(rPrDefault, "rpr")[0] : null;
    const pPr = pPrDefault ? descendantsByLocalName(pPrDefault, "ppr")[0] : null;
    const rFonts = rPr ? firstChildByLocalName(rPr, "rfonts") : null;
    const sz = rPr ? firstChildByLocalName(rPr, "sz") : null;
    const spacing = pPr ? firstChildByLocalName(pPr, "spacing") : null;
    const ind = pPr ? firstChildByLocalName(pPr, "ind") : null;
    defaultFont = attr(rFonts, "eastAsia") || attr(rFonts, "ascii") || attr(rFonts, "hAnsi") || null;
    defaultSizeHalfPt = parseNumber(attr(sz, "val"));
    defaultLineTwips = parseNumber(attr(spacing, "line"));
    defaultFirstIndentTwips = parseNumber(attr(ind, "firstLine"));
    const beforeTwips = parseNumber(attr(spacing, "before"));
    const afterTwips = parseNumber(attr(spacing, "after"));
    defaultSpaceBeforePt = beforeTwips === null ? null : beforeTwips / 20;
    defaultSpaceAfterPt = afterTwips === null ? null : afterTwips / 20;
  }

  const paragraphs = descendantsByLocalName(doc.documentElement, "p");
  const parsedParagraphs: ParagraphInfo[] = [];
  let hasPageField = false;
  let hasTocField = false;

  for (let i = 0; i < paragraphs.length; i += 1) {
    const p = paragraphs[i];
    const textNodes = descendantsByLocalName(p, "t");
    const text = normalizeText(textNodes.map((n) => n.textContent || "").join(""));
    if (!text) continue;

    const pPr = firstChildByLocalName(p, "ppr");
    const pStyle = pPr ? firstChildByLocalName(pPr, "pstyle") : null;
    const spacing = pPr ? firstChildByLocalName(pPr, "spacing") : null;
    const ind = pPr ? firstChildByLocalName(pPr, "ind") : null;
    const jc = pPr ? firstChildByLocalName(pPr, "jc") : null;
    const numPr = pPr ? firstChildByLocalName(pPr, "numPr") : null;
    const numIdNode = numPr ? firstChildByLocalName(numPr, "numId") : null;
    const ilvlNode = numPr ? firstChildByLocalName(numPr, "ilvl") : null;

    const styleId = attr(pStyle, "val");
    const align = attr(jc, "val") || null;
    const lineTwips = parseNumber(attr(spacing, "line")) ?? defaultLineTwips;
    const firstIndentTwips = parseNumber(attr(ind, "firstLine")) ?? defaultFirstIndentTwips;
    const beforeTwips = parseNumber(attr(spacing, "before"));
    const afterTwips = parseNumber(attr(spacing, "after"));
    const spaceBeforePt = beforeTwips === null ? defaultSpaceBeforePt : beforeTwips / 20;
    const spaceAfterPt = afterTwips === null ? defaultSpaceAfterPt : afterTwips / 20;
    const numId = parseNumber(attr(numIdNode, "val"));
    const ilvl = parseNumber(attr(ilvlNode, "val"));

    const runs = descendantsByLocalName(p, "r").map((r) => {
      const rText = normalizeText(descendantsByLocalName(r, "t").map((n) => n.textContent || "").join(""));
      const rPr = firstChildByLocalName(r, "rpr");
      const rFonts = rPr ? firstChildByLocalName(rPr, "rfonts") : null;
      const sz = rPr ? firstChildByLocalName(rPr, "sz") : null;
      const b = rPr ? firstChildByLocalName(rPr, "b") : null;
      const boldRaw = attr(b, "val");
      const bold = b ? boldRaw !== "0" && boldRaw !== "false" : null;
      const font = attr(rFonts, "eastAsia") || attr(rFonts, "ascii") || attr(rFonts, "hAnsi") || defaultFont || null;
      const sizeHalfPt = parseNumber(attr(sz, "val")) ?? defaultSizeHalfPt;
      return { text: rText, font, sizeHalfPt, bold };
    });

    const instrTexts = descendantsByLocalName(p, "instrText")
      .map((n) => normalizeText(n.textContent || ""))
      .filter(Boolean);
    const fldSimple = descendantsByLocalName(p, "fldSimple").map((n) => normalizeText(attr(n, "instr")));
    const fieldText = toAsciiLower([...instrTexts, ...fldSimple].join(" "));
    const tocField = fieldText.includes("toc");
    const pageField = fieldText.includes("page");
    if (tocField) hasTocField = true;
    if (pageField) hasPageField = true;

    const inTable = hasAncestorWithLocalName(p, "tbl");
    const hasDrawing = descendantsByLocalName(p, "drawing").length > 0;

    parsedParagraphs.push({
      index: i + 1,
      text,
      styleId,
      align,
      lineTwips,
      firstIndentTwips,
      spaceBeforePt,
      spaceAfterPt,
      numId,
      ilvl,
      inTable,
      hasDrawing,
      hasTocField: tocField,
      hasPageField: pageField,
      runs,
    });
  }

  const sectionNodes = descendantsByLocalName(doc.documentElement, "sectPr");
  const sections: SectionInfo[] = sectionNodes.map((sect) => {
    const pgSz = firstChildByLocalName(sect, "pgSz");
    const pgMar = firstChildByLocalName(sect, "pgMar");
    const headerRefs = childrenByLocalName(sect, "headerReference").length;
    const footerRefs = childrenByLocalName(sect, "footerReference").length;
    return {
      pageWidthTwips: parseNumber(attr(pgSz, "w")),
      pageHeightTwips: parseNumber(attr(pgSz, "h")),
      marginTopTwips: parseNumber(attr(pgMar, "top")),
      marginBottomTwips: parseNumber(attr(pgMar, "bottom")),
      marginLeftTwips: parseNumber(attr(pgMar, "left")),
      marginRightTwips: parseNumber(attr(pgMar, "right")),
      headerRefs,
      footerRefs,
    };
  });

  return {
    paragraphs: parsedParagraphs,
    sections,
    hasPageField,
    hasTocField,
  };
}

function detectHeadingLevel(paragraph: ParagraphInfo): number | null {
  if (paragraph.hasTocField) return null;
  const style = toAsciiLower(paragraph.styleId);
  if (/heading[\s_-]*1|标题[\s_-]*1|biaoti[\s_-]*1/.test(style)) return 1;
  if (/heading[\s_-]*2|标题[\s_-]*2|biaoti[\s_-]*2/.test(style)) return 2;
  if (/heading[\s_-]*3|标题[\s_-]*3|biaoti[\s_-]*3/.test(style)) return 3;

  const text = normalizeText(paragraph.text);
  if (text.length > 42) return null;
  if (!text || /[\u2026\.]{3,}\s*\d+\s*$/.test(text)) return null;
  if (/^第[一二三四五六七八九十百千万\d]+章(\s|$)/.test(text)) return 1;

  // 仅在具有较强标题特征时，才将编号段落视作标题，避免把正文编号行误判为标题。
  const run = firstMeaningfulRun(paragraph);
  const hasStrongCue =
    run?.bold === true ||
    toAsciiLower(paragraph.align || "") === "center" ||
    (!/[，,。；;：:！？!?]$/.test(text) && text.length <= 28);
  if (!hasStrongCue) return null;

  if (/^\d+\.\d+\.\d+(\s|$)/.test(text)) return 3;
  if (/^\d+\.\d+(\s|$)/.test(text)) return 2;
  return null;
}

function firstMeaningfulRun(paragraph: ParagraphInfo): RunInfo | null {
  for (const run of paragraph.runs) {
    if (normalizeText(run.text)) return run;
  }
  return null;
}

function alignMatches(expected: string, actual: string | null): boolean {
  const e = toAsciiLower(expected);
  const a = toAsciiLower(actual || "");
  if (!e) return true;
  if (!a) return false;
  if (e === "center") return a === "center";
  if (e === "left") return a === "left" || a === "start";
  if (e === "right") return a === "right" || a === "end";
  if (e === "justify") return a === "both" || a === "distribute" || a === "justify";
  return e === a;
}

function isBodyParagraph(paragraph: ParagraphInfo): boolean {
  if (!normalizeText(paragraph.text)) return false;
  const text = paragraph.text;
  if (isTitleKeyword(text, headingKeywordMap.reference)) return false;
  return detectHeadingLevel(paragraph) === null;
}

function isTitleKeyword(text: string, keywords: string[]): boolean {
  const t = toAsciiLower(normalizeText(text));
  const compact = t.replace(/\s+/g, "");
  return keywords.some((k) => {
    const kk = toAsciiLower(k);
    return compact === kk.replace(/\s+/g, "") || compact.startsWith(kk.replace(/\s+/g, ""));
  });
}

function addBodyRules(docInfo: DocInfo, rules: RuleRow[], issues: Issue[]) {
  const bodyParas = docInfo.paragraphs.filter(isBodyParagraph).slice(0, 220);
  if (!bodyParas.length) return;

  if (hasRule(rules, "BODY_FONT")) {
    const cfg = ruleConfig(rules, "BODY_FONT");
    const expectedFont = String(cfg.font_name || "").trim();
    if (expectedFont) {
      let count = 0;
      for (const p of bodyParas) {
        const mismatch = p.runs.some((run) => {
          const txt = normalizeText(run.text);
          return !!txt && !!run.font && run.font !== expectedFont;
        });
        if (mismatch) {
          count += 1;
          if (count <= 40) {
            issues.push(
              makeIssue({
                problemType: "body_font",
                problemDesc: "body font mismatch",
                position: `paragraph ${p.index} (${toPreview(p.text)})`,
                suggestion: "use standard body font",
                severity: ruleSeverity(rules, "BODY_FONT", "ERROR"),
              }),
            );
          }
        }
      }
    }
  }

  if (hasRule(rules, "BODY_FONT_SIZE")) {
    const cfg = ruleConfig(rules, "BODY_FONT_SIZE");
    const expected = Number(cfg.font_size_pt || 0);
    if (expected > 0) {
      const expectedHalfPt = ptToHalfPt(expected);
      let count = 0;
      for (const p of bodyParas) {
        const mismatch = p.runs.some((run) => {
          const txt = normalizeText(run.text);
          return !!txt && run.sizeHalfPt !== null && Math.abs(run.sizeHalfPt - expectedHalfPt) > 0.8;
        });
        if (mismatch) {
          count += 1;
          if (count <= 40) {
            issues.push(
              makeIssue({
                problemType: "body_font_size",
                problemDesc: "body font size mismatch",
                position: `paragraph ${p.index} (${toPreview(p.text)})`,
                suggestion: "use standard body font size",
                severity: ruleSeverity(rules, "BODY_FONT_SIZE", "ERROR"),
              }),
            );
          }
        }
      }
    }
  }

  if (hasRule(rules, "BODY_LINE_SPACING")) {
    const cfg = ruleConfig(rules, "BODY_LINE_SPACING");
    const expected = Number(cfg.line_spacing || 0);
    if (expected > 0) {
      const expectedTwips = lineSpacingToTwips(expected);
      let count = 0;
      for (const p of bodyParas) {
        if (!between(p.lineTwips, expectedTwips, 30)) {
          count += 1;
          if (count <= 40) {
            issues.push(
              makeIssue({
                problemType: "line_spacing",
                problemDesc: "body line spacing mismatch",
                position: `paragraph ${p.index} (${toPreview(p.text)})`,
                suggestion: "set body line spacing to standard value",
                severity: ruleSeverity(rules, "BODY_LINE_SPACING", "WARNING"),
              }),
            );
          }
        }
      }
    }
  }

  if (hasRule(rules, "BODY_FIRST_INDENT")) {
    const cfg = ruleConfig(rules, "BODY_FIRST_INDENT");
    const chars = Number(cfg.first_line_indent_chars || 0);
    if (chars > 0) {
      const expectedTwips = chars * 210;
      let count = 0;
      for (const p of bodyParas) {
        if (!between(p.firstIndentTwips, expectedTwips, 70)) {
          count += 1;
          if (count <= 40) {
            issues.push(
              makeIssue({
                problemType: "first_line_indent",
                problemDesc: "body first line indent mismatch",
                position: `paragraph ${p.index} (${toPreview(p.text)})`,
                suggestion: "set first line indent to standard value",
                severity: ruleSeverity(rules, "BODY_FIRST_INDENT", "WARNING"),
              }),
            );
          }
        }
      }
    }
  }

  if (hasRule(rules, "BODY_ALIGNMENT")) {
    const cfg = ruleConfig(rules, "BODY_ALIGNMENT");
    const expectedAlign = String(cfg.align || "").trim();
    if (expectedAlign) {
      let count = 0;
      for (const p of bodyParas) {
        if (!alignMatches(expectedAlign, p.align)) {
          count += 1;
          if (count <= 30) {
            issues.push(
              makeIssue({
                problemType: "paragraph_alignment",
                problemDesc: "body paragraph alignment mismatch",
                position: `paragraph ${p.index} (${toPreview(p.text)})`,
                suggestion: "align body paragraph to standard value",
                severity: ruleSeverity(rules, "BODY_ALIGNMENT", "INFO"),
              }),
            );
          }
        }
      }
    }
  }

  if (hasRule(rules, "BODY_PARAGRAPH_SPACING")) {
    const cfg = ruleConfig(rules, "BODY_PARAGRAPH_SPACING");
    const expectedBefore = Number(cfg.space_before_pt ?? 0);
    const expectedAfter = Number(cfg.space_after_pt ?? 0);
    let count = 0;
    for (const p of bodyParas) {
      const badBefore = p.spaceBeforePt === null ? false : Math.abs(p.spaceBeforePt - expectedBefore) > 0.6;
      const badAfter = p.spaceAfterPt === null ? false : Math.abs(p.spaceAfterPt - expectedAfter) > 0.6;
      if (badBefore || badAfter) {
        count += 1;
        if (count <= 30) {
          issues.push(
            makeIssue({
              problemType: "paragraph_spacing",
              problemDesc: "body paragraph spacing mismatch",
              position: `paragraph ${p.index} (${toPreview(p.text)})`,
              suggestion: "set paragraph spacing to standard value",
              severity: ruleSeverity(rules, "BODY_PARAGRAPH_SPACING", "INFO"),
            }),
          );
        }
      }
    }
  }
}

function addPageRules(docInfo: DocInfo, rules: RuleRow[], issues: Issue[]) {
  const firstSection = docInfo.sections[0];

  if (hasRule(rules, "PAGE_MARGIN")) {
    const cfg = ruleConfig(rules, "PAGE_MARGIN");
    if (!firstSection) {
      issues.push(
        makeIssue({
          problemType: "page_margin",
          problemDesc: "page margin information missing",
          position: "document",
          suggestion: "set page margin according to template",
          severity: ruleSeverity(rules, "PAGE_MARGIN", "ERROR"),
          confidence: 0.6,
          issueStatus: "manual_review",
          autoFix: false,
          reasons: ["format_value_unknown"],
        }),
      );
    } else {
      const checks: Array<{ key: string; actual: number | null; expectedCm: number }> = [
        { key: "top", actual: firstSection.marginTopTwips, expectedCm: Number(cfg.top_cm || 0) },
        { key: "bottom", actual: firstSection.marginBottomTwips, expectedCm: Number(cfg.bottom_cm || 0) },
        { key: "left", actual: firstSection.marginLeftTwips, expectedCm: Number(cfg.left_cm || 0) },
        { key: "right", actual: firstSection.marginRightTwips, expectedCm: Number(cfg.right_cm || 0) },
      ];
      const bad = checks.filter((x) => x.expectedCm > 0 && !between(x.actual, cmToTwips(x.expectedCm), 25));
      if (bad.length) {
        issues.push(
          makeIssue({
            problemType: "page_margin",
            problemDesc: "page margin mismatch",
            position: "document",
            suggestion: "set page margins to template values",
            severity: ruleSeverity(rules, "PAGE_MARGIN", "ERROR"),
          }),
        );
      }
    }
  }

  if (hasRule(rules, "PAGE_SIZE")) {
    const cfg = ruleConfig(rules, "PAGE_SIZE");
    const expectedW = Number(cfg.paper_width_cm || 0);
    const expectedH = Number(cfg.paper_height_cm || 0);
    if (firstSection && expectedW > 0 && expectedH > 0) {
      const okW = between(firstSection.pageWidthTwips, cmToTwips(expectedW), 20);
      const okH = between(firstSection.pageHeightTwips, cmToTwips(expectedH), 20);
      if (!okW || !okH) {
        issues.push(
          makeIssue({
            problemType: "paper_size",
            problemDesc: "paper size mismatch",
            position: "document",
            suggestion: "set paper size to A4",
            severity: ruleSeverity(rules, "PAGE_SIZE", "ERROR"),
          }),
        );
      }
    }
  }

  if (hasRule(rules, "SECTION_BREAK")) {
    const cfg = ruleConfig(rules, "SECTION_BREAK");
    const maxSections = Number(cfg.max_sections || 1);
    if (maxSections > 0 && docInfo.sections.length > maxSections) {
      issues.push(
        makeIssue({
          problemType: "section_break",
          problemDesc: "too many sections detected",
          position: "document",
          suggestion: "reduce unnecessary section breaks",
          severity: ruleSeverity(rules, "SECTION_BREAK", "WARNING"),
        }),
      );
    }
  }

  if (hasRule(rules, "HEADER_FOOTER")) {
    const severity = ruleSeverity(rules, "HEADER_FOOTER", "WARNING");
    const cfg = ruleConfig(rules, "HEADER_FOOTER");
    const requireHeader = parseYesNoLike(cfg.require_header, true);
    const requireFooter = parseYesNoLike(cfg.require_footer, true);

    const headerMissing = requireHeader && docInfo.sections.some((s) => s.headerRefs <= 0);
    const footerMissing = requireFooter && docInfo.sections.some((s) => s.footerRefs <= 0);

    if (headerMissing) {
      issues.push(
        makeIssue({
          problemType: "header_footer",
          problemDesc: "header missing",
          position: "document",
          suggestion: "add header content",
          severity,
        }),
      );
    }
    if (footerMissing) {
      issues.push(
        makeIssue({
          problemType: "header_footer",
          problemDesc: "footer missing",
          position: "document",
          suggestion: "add footer content",
          severity,
        }),
      );
    }
  }

  if (hasRule(rules, "PAGE_NUMBER")) {
    if (!docInfo.hasPageField) {
      issues.push(
        makeIssue({
          problemType: "page_number",
          problemDesc: "page number field not detected",
          position: "document",
          suggestion: "insert page number field",
          severity: ruleSeverity(rules, "PAGE_NUMBER", "WARNING"),
          autoFix: false,
        }),
      );
    }
  }
}

function addTocRules(docInfo: DocInfo, rules: RuleRow[], issues: Issue[]) {
  if (!hasRule(rules, "TOC_CHECK")) return;
  const cfg = ruleConfig(rules, "TOC_CHECK");
  const requireAutoToc = parseYesNoLike(cfg.require_auto_toc, true);
  if (requireAutoToc && !docInfo.hasTocField) {
    issues.push(
      makeIssue({
        problemType: "toc",
        problemDesc: "table of contents field not detected",
        position: "catalog region",
        suggestion: "insert/update automatic TOC field",
        severity: ruleSeverity(rules, "TOC_CHECK", "WARNING"),
        autoFix: false,
      }),
    );
  }
}

function headingCandidates(docInfo: DocInfo): Array<{ p: ParagraphInfo; level: number }> {
  return docInfo.paragraphs
    .map((p) => ({ p, level: detectHeadingLevel(p) }))
    .filter(
      (x): x is { p: ParagraphInfo; level: number } => x.level !== null && !x.p.hasTocField && !x.p.inTable,
    );
}

function parseHeadingNumberTuple(text: string): number[] {
  const t = normalizeText(text);
  const m = t.match(/^(\d+(?:\.\d+){0,3})/);
  if (!m) return [];
  return m[1].split(".").map((x) => Number(x));
}

function addHeadingRules(docInfo: DocInfo, rules: RuleRow[], issues: Issue[]) {
  const headings = headingCandidates(docInfo);

  for (const level of [1, 2, 3]) {
    const ruleCode = `HEADING_LEVEL_${level}`;
    if (!hasRule(rules, ruleCode)) continue;
    const cfg = ruleConfig(rules, ruleCode);
    const expectedFont = String(cfg.font_name || "").trim();
    const expectedSize = Number(cfg.font_size_pt || 0);
    const expectedBold = parseYesNoLike(cfg.bold, true);
    const expectedAlign = String(cfg.align || "").trim();
    const severity = ruleSeverity(rules, ruleCode, "ERROR");

    const levelHeadings = headings.filter((h) => h.level === level).slice(0, 120);
    for (const item of levelHeadings) {
      const p = item.p;
      const run = firstMeaningfulRun(p);
      if (!run) continue;

      const position = `paragraph ${p.index} (${toPreview(p.text)})`;
      const mismatchReasons: string[] = [];
      if (expectedFont && run.font && run.font !== expectedFont) mismatchReasons.push("font");
      if (expectedSize > 0 && run.sizeHalfPt !== null && Math.abs(run.sizeHalfPt - ptToHalfPt(expectedSize)) > 0.8) {
        mismatchReasons.push("font_size");
      }
      if (run.bold !== null && run.bold !== expectedBold) mismatchReasons.push("bold");
      if (expectedAlign && !alignMatches(expectedAlign, p.align)) mismatchReasons.push("align");

      if (mismatchReasons.length) {
        issues.push(
          makeIssue({
            problemType: "heading_format",
            problemDesc: `heading style mismatch: ${mismatchReasons.join(",")}`,
            position,
            suggestion: "normalize heading style",
            severity,
            reasons: ["matched_style_name", ...mismatchReasons],
          }),
        );
      }
    }
  }

  if (hasRule(rules, "HEADING_NUMBER")) {
    const sev = ruleSeverity(rules, "HEADING_NUMBER", "ERROR");
    const tuples = headings
      .map((h) => ({ p: h.p, level: h.level, nums: parseHeadingNumberTuple(h.p.text) }))
      .filter((x) => x.nums.length > 0);
    for (let i = 1; i < tuples.length; i += 1) {
      const prev = tuples[i - 1];
      const cur = tuples[i];
      if (cur.level - prev.level > 1) {
        issues.push(
          makeIssue({
            problemType: "heading_hierarchy",
            problemDesc: "heading hierarchy jump detected",
            position: `paragraph ${cur.p.index} (${toPreview(cur.p.text)})`,
            suggestion: "check heading numbering sequence",
            severity: sev,
          }),
        );
      }
      if (cur.level === prev.level) {
        const pNum = prev.nums[prev.level - 1];
        const cNum = cur.nums[cur.level - 1];
        if (Number.isFinite(pNum) && Number.isFinite(cNum) && cNum !== pNum + 1) {
          issues.push(
            makeIssue({
              problemType: "heading_number",
              problemDesc: "heading number not continuous",
              position: `paragraph ${cur.p.index} (${toPreview(cur.p.text)})`,
              suggestion: "check heading numbering sequence",
              severity: sev,
            }),
          );
        }
      }
    }
  }

  const titleRules: Array<{ ruleCode: string; keywords: string[]; label: string }> = [
    { ruleCode: "ABSTRACT_ZH_TITLE", keywords: headingKeywordMap.abstractZh, label: "abstract zh title" },
    { ruleCode: "ABSTRACT_EN_TITLE", keywords: headingKeywordMap.abstractEn, label: "abstract en title" },
    { ruleCode: "CONCLUSION_TITLE", keywords: headingKeywordMap.conclusion, label: "conclusion title" },
    { ruleCode: "THANKS_TITLE", keywords: headingKeywordMap.thanks, label: "thanks title" },
    { ruleCode: "REFERENCE_TITLE", keywords: headingKeywordMap.reference, label: "reference title" },
    { ruleCode: "APPENDIX_TITLE", keywords: headingKeywordMap.appendix, label: "appendix title" },
  ];

  for (const item of titleRules) {
    if (!hasRule(rules, item.ruleCode)) continue;
    const sev = ruleSeverity(rules, item.ruleCode, "ERROR");
    const cfg = ruleConfig(rules, item.ruleCode);
    const expectedFont = String(cfg.font_name || "").trim();
    const expectedSize = Number(cfg.font_size_pt || 0);
    const expectedBold = parseYesNoLike(cfg.bold, true);
    const expectedAlign = String(cfg.align || "").trim();

    const target = docInfo.paragraphs.find((p) => isTitleKeyword(p.text, item.keywords));
    if (!target) {
      issues.push(
        makeIssue({
          problemType: "heading_format",
          problemDesc: `${item.label} missing`,
          position: "document",
          suggestion: "add missing section title",
          severity: sev,
          confidence: 0.75,
          issueStatus: "suspected",
          autoFix: false,
          reasons: ["low_confidence"],
        }),
      );
      continue;
    }

    const run = firstMeaningfulRun(target);
    if (!run) continue;

    const position = `paragraph ${target.index} (${toPreview(target.text)})`;
    const mismatchReasons: string[] = [];
    if (expectedFont && run.font && run.font !== expectedFont) mismatchReasons.push("font");
    if (expectedSize > 0 && run.sizeHalfPt !== null && Math.abs(run.sizeHalfPt - ptToHalfPt(expectedSize)) > 0.8) {
      mismatchReasons.push("font_size");
    }
    if (run.bold !== null && run.bold !== expectedBold) mismatchReasons.push("bold");
    if (expectedAlign && !alignMatches(expectedAlign, target.align)) mismatchReasons.push("align");

    if (mismatchReasons.length) {
      issues.push(
        makeIssue({
          problemType: "heading_format",
          problemDesc: `${item.label} style mismatch: ${mismatchReasons.join(",")}`,
          position,
          suggestion: "normalize heading style",
          severity: sev,
          reasons: ["matched_style_name", ...mismatchReasons],
        }),
      );
    }
  }
}
function extractReferenceEntries(docInfo: DocInfo): { startIdx: number; entries: ParagraphInfo[] } | null {
  const title = docInfo.paragraphs.find((p) => isTitleKeyword(p.text, headingKeywordMap.reference));
  if (!title) return null;
  const start = title.index;
  const rawTail = docInfo.paragraphs
    .filter((p) => p.index > start && !isTitleKeyword(p.text, headingKeywordMap.appendix))
    .slice(0, 350);

  const entries: ParagraphInfo[] = [];
  let started = false;
  let nonEntryStreak = 0;
  for (const p of rawTail) {
    const text = normalizeText(p.text);
    if (!text) continue;

    if (detectHeadingLikeLine(text) && started) break;
    const likely = isLikelyReferenceEntryText(text);
    if (likely) {
      entries.push(p);
      started = true;
      nonEntryStreak = 0;
      continue;
    }

    if (!started) continue;
    nonEntryStreak += 1;
    if (nonEntryStreak >= 6) break;
  }

  return { startIdx: start, entries: entries.slice(0, 180) };
}

function parseRefNumber(text: string): { n: number | null; format: string | null } {
  const t = normalizeText(text);
  let m = t.match(/^\[(\d+)\]/);
  if (m) return { n: Number(m[1]), format: "[n]" };
  m = t.match(/^(\d+)[\.\)]\s*/);
  if (m) return { n: Number(m[1]), format: "n." };
  return { n: null, format: null };
}

function isLikelyReferenceEntryText(text: string): boolean {
  const t = normalizeText(text);
  if (!t) return false;
  if (t.length < 6 || t.length > 420) return false;
  if (/^\[(\d+)\]/.test(t) || /^(\d+)[\.\)]\s*/.test(t)) return true;
  if (/(19|20)\d{2}/.test(t) && /[,\.;:，。；：]/.test(t)) return true;
  if (/\[[JMBCRDSP]\]/i.test(t)) return true;
  return false;
}

function detectHeadingLikeLine(text: string): boolean {
  const t = normalizeText(text);
  if (!t || t.length > 60) return false;
  if (/^第[一二三四五六七八九十百千万\d]+章(\s|$)/.test(t)) return true;
  if (/^\d+\.\d+(\.\d+)?(\s|$)/.test(t)) return true;
  return false;
}

function addReferenceRules(docInfo: DocInfo, rules: RuleRow[], issues: Issue[]) {
  const refRegion = extractReferenceEntries(docInfo);

  const hasRefSeq = hasRule(rules, "REFERENCE_SEQ");
  const hasRefFmt = hasRule(rules, "REFERENCE_FORMAT");

  if ((hasRefSeq || hasRefFmt) && !refRegion) {
    issues.push(
      makeIssue({
        problemType: "reference_region_missing",
        problemDesc: "reference region not detected",
        position: "document",
        suggestion: "confirm whether references section is present",
        severity: ruleSeverity(rules, hasRefSeq ? "REFERENCE_SEQ" : "REFERENCE_FORMAT", "ERROR"),
        autoFix: false,
      }),
    );
    return;
  }

  if (!refRegion) return;
  const entries = refRegion.entries.filter((p) => normalizeText(p.text));
  if (!entries.length) {
    issues.push(
      makeIssue({
        problemType: "reference_entries_empty",
        problemDesc: "references region exists but contains no entries",
        position: "references region",
        suggestion: "add reference entries under references heading",
        severity: ruleSeverity(rules, hasRefSeq ? "REFERENCE_SEQ" : "REFERENCE_FORMAT", "ERROR"),
      }),
    );
    return;
  }

  if (hasRefSeq) {
    const seqSeverity = ruleSeverity(rules, "REFERENCE_SEQ", "ERROR");
    const seqCfg = ruleConfig(rules, "REFERENCE_SEQ");
    const expectedFmt = String(seqCfg.format || "").trim();
    const expectsNumbering = ["[n]", "n.", "numeric"].includes(toAsciiLower(expectedFmt));
    const parsedEntries = entries.map((entry) => ({ entry, parsed: parseRefNumber(entry.text) }));
    const numberedCount = parsedEntries.filter((x) => x.parsed.n !== null).length;
    const numberedRatio = entries.length ? numberedCount / entries.length : 0;
    const shouldTreatAsNumbered = expectsNumbering || numberedRatio >= 0.5;

    if (!shouldTreatAsNumbered) {
      issues.push(
        makeIssue({
          problemType: "reference_region_uncertain",
          problemDesc: "reference entries uncertain",
          position: "references region",
          suggestion: "manual review suggested",
          severity: "WARNING",
          confidence: 0.78,
          issueStatus: "manual_review",
          autoFix: false,
          reasons: ["suspected_by_heuristics"],
        }),
      );
    } else {
      const numbers: number[] = [];
      const formats: string[] = [];
      let unknownCount = 0;

      for (const item of parsedEntries) {
        const { entry, parsed } = item;
        if (parsed.n === null) {
          unknownCount += 1;
          issues.push(
            makeIssue({
              problemType: "reference_entry_unrecognized",
              problemDesc: "entry numbering format not recognized",
              position: `paragraph ${entry.index} (${toPreview(entry.text)})`,
              suggestion: "verify if this paragraph is a reference entry",
              severity: seqSeverity,
              confidence: 0.72,
              issueStatus: "suspected",
              autoFix: false,
            }),
          );
        } else {
          numbers.push(parsed.n);
          if (parsed.format) formats.push(parsed.format);
        }
      }

      if (formats.length >= 1) {
        const uniq = [...new Set(formats)];
        if (uniq.length > 1) {
          issues.push(
            makeIssue({
              problemType: "reference_numbering_mixed_format",
              problemDesc: "reference numbering is not continuous",
              position: "references region",
              suggestion: "use one consistent numbering format",
              severity: seqSeverity,
            }),
          );
        } else if (expectedFmt && uniq[0] !== expectedFmt) {
          issues.push(
            makeIssue({
              problemType: "reference_numbering",
              problemDesc: "reference numbering format mismatch",
              position: "references region",
              suggestion: "use one consistent numbering format",
              severity: seqSeverity,
            }),
          );
        }
      }

      const seen = new Set<number>();
      for (let i = 0; i < numbers.length; i += 1) {
        const n = numbers[i];
        if (seen.has(n)) {
          issues.push(
            makeIssue({
              problemType: "reference_number_duplicate",
              problemDesc: "duplicate reference number detected",
              position: "references region",
              suggestion: "sort or renumber reference entries",
              severity: seqSeverity,
            }),
          );
        }
        seen.add(n);
        if (i > 0 && n < numbers[i - 1]) {
          issues.push(
            makeIssue({
              problemType: "reference_number_out_of_order",
              problemDesc: "reference numbers are out of order",
              position: "references region",
              suggestion: "sort or renumber reference entries",
              severity: seqSeverity,
            }),
          );
        }
      }
      if (numbers.length > 1) {
        const min = Math.min(...numbers);
        const max = Math.max(...numbers);
        if (max - min + 1 !== numbers.length) {
          issues.push(
            makeIssue({
              problemType: "reference_number_not_continuous",
              problemDesc: "reference index not continuous",
              position: "references region",
              suggestion: "renumber references continuously",
              severity: seqSeverity,
            }),
          );
        }
      }
      if (unknownCount >= Math.ceil(entries.length * 0.4)) {
        issues.push(
          makeIssue({
            problemType: "reference_region_uncertain",
            problemDesc: "reference entries uncertain",
            position: "references region",
            suggestion: "manual review suggested",
            severity: seqSeverity,
            confidence: 0.65,
            issueStatus: "manual_review",
            autoFix: false,
            reasons: ["suspected_by_heuristics"],
          }),
        );
      }
    }
  }

  if (hasRefFmt) {
    const fmtSeverity = ruleSeverity(rules, "REFERENCE_FORMAT", "WARNING");
    const cfg = ruleConfig(rules, "REFERENCE_FORMAT");
    const checkCompleteness = parseYesNoLike(cfg.check_completeness, true);
    const checkTypeMark = parseYesNoLike(cfg.check_type_mark, true);
    const checkPunctuation = parseYesNoLike(cfg.check_punctuation, true);

    for (const entry of entries.slice(0, 160)) {
      const t = normalizeText(entry.text);
      const pos = `paragraph ${entry.index} (${toPreview(entry.text)})`;
      if (checkCompleteness) {
        const hasYear = /(19|20)\d{2}/.test(t);
        const hasDelimiter = /[锛?銆?;锛?]/.test(t);
        if (!hasYear || !hasDelimiter || t.length < 8) {
          issues.push(
            makeIssue({
              problemType: "reference_completeness",
              problemDesc: "reference completeness check failed",
              position: pos,
              suggestion: "fill this reference entry content",
              severity: fmtSeverity,
            }),
          );
        }
      }
      if (checkTypeMark && !/\[[JMBCRDSP]\]/i.test(t)) {
        issues.push(
          makeIssue({
            problemType: "reference_type_mark",
            problemDesc: "reference type mark missing",
            position: pos,
            suggestion: "append proper reference type mark",
            severity: fmtSeverity,
          }),
        );
      }
      if (checkPunctuation && /,,|銆傘€倈;;/.test(t)) {
        issues.push(
          makeIssue({
            problemType: "reference_punctuation",
            problemDesc: "reference punctuation issue",
            position: pos,
            suggestion: "normalize reference punctuation",
            severity: fmtSeverity,
          }),
        );
      }
    }
  }
}

function addFigureTableRules(docInfo: DocInfo, rules: RuleRow[], issues: Issue[]) {
  if (!hasRule(rules, "FIGURE_TABLE")) return;
  const sev = ruleSeverity(rules, "FIGURE_TABLE", "WARNING");
  const cfg = ruleConfig(rules, "FIGURE_TABLE");
  const figurePrefix = String(cfg.figure_prefix || "FIG").trim();
  const tablePrefix = String(cfg.table_prefix || "TAB").trim();

  const figRegex = new RegExp(`^(鍥緗${figurePrefix}|Figure)\\s*([\\d\\.]+)`, "i");
  const tabRegex = new RegExp(`^(琛▅${tablePrefix}|Table)\\s*([\\d\\.]+)`, "i");

  const figureCaptions = docInfo.paragraphs.filter((p) => figRegex.test(normalizeText(p.text)));
  const tableCaptions = docInfo.paragraphs.filter((p) => tabRegex.test(normalizeText(p.text)));
  const imageParas = docInfo.paragraphs.filter((p) => p.hasDrawing);
  const tableParas = docInfo.paragraphs.filter((p) => p.inTable);

  const checkNumberContinuity = parseYesNoLike(cfg.check_number_continuity, true);
  const checkCaptionPos = parseYesNoLike(cfg.check_caption_position, true);
  const figurePos = toAsciiLower(String(cfg.figure_caption_position || "below"));
  const tablePos = toAsciiLower(String(cfg.table_caption_position || "above"));

  if (checkNumberContinuity) {
    const figNums = figureCaptions
      .map((p) => normalizeText(p.text).match(figRegex)?.[2] || "")
      .map((x) => Number(String(x).split(".")[0]))
      .filter((x) => Number.isFinite(x));
    for (let i = 1; i < figNums.length; i += 1) {
      if (figNums[i] !== figNums[i - 1] + 1) {
        issues.push(
          makeIssue({
            problemType: "figure_table_number",
            problemDesc: "figure numbering is not continuous",
            position: "document",
            suggestion: "renumber figure captions continuously",
            severity: sev,
          }),
        );
        break;
      }
    }

    const tabNums = tableCaptions
      .map((p) => normalizeText(p.text).match(tabRegex)?.[2] || "")
      .map((x) => Number(String(x).split(".")[0]))
      .filter((x) => Number.isFinite(x));
    for (let i = 1; i < tabNums.length; i += 1) {
      if (tabNums[i] !== tabNums[i - 1] + 1) {
        issues.push(
          makeIssue({
            problemType: "figure_table_number",
            problemDesc: "table numbering is not continuous",
            position: "document",
            suggestion: "renumber table captions continuously",
            severity: sev,
          }),
        );
        break;
      }
    }
  }

  if (checkCaptionPos && imageParas.length) {
    for (const p of imageParas.slice(0, 60)) {
      const prev = docInfo.paragraphs.find((x) => x.index === p.index - 1);
      const next = docInfo.paragraphs.find((x) => x.index === p.index + 1);
      const hasPrevCaption = !!prev && figRegex.test(normalizeText(prev.text));
      const hasNextCaption = !!next && figRegex.test(normalizeText(next.text));
      const ok = figurePos === "below" ? hasNextCaption : hasPrevCaption;
      if (!ok) {
        issues.push(
          makeIssue({
            problemType: "figure_caption_position",
            problemDesc: "figure caption position mismatch",
            position: `paragraph ${p.index}`,
            suggestion: "move figure caption to required position",
            severity: sev,
          }),
        );
      }
    }
  }

  if (checkCaptionPos && tableParas.length) {
    for (const p of tableParas.slice(0, 60)) {
      const prev = docInfo.paragraphs.find((x) => x.index === p.index - 1);
      const next = docInfo.paragraphs.find((x) => x.index === p.index + 1);
      const hasPrevCaption = !!prev && tabRegex.test(normalizeText(prev.text));
      const hasNextCaption = !!next && tabRegex.test(normalizeText(next.text));
      const ok = tablePos === "above" ? hasPrevCaption : hasNextCaption;
      if (!ok) {
        issues.push(
          makeIssue({
            problemType: "table_caption_position",
            problemDesc: "table caption position mismatch",
            position: `paragraph ${p.index}`,
            suggestion: "move table caption to required position",
            severity: sev,
          }),
        );
      }
    }
  }

  if (parseYesNoLike(cfg.check_image_center, true)) {
    for (const p of imageParas.slice(0, 80)) {
      if (!alignMatches("center", p.align)) {
        issues.push(
          makeIssue({
            problemType: "image_alignment",
            problemDesc: "image alignment mismatch",
            position: `paragraph ${p.index}`,
            suggestion: "center align image paragraphs",
            severity: sev,
          }),
        );
      }
    }
  }
}

function addCoverRules(docInfo: DocInfo, rules: RuleRow[], issues: Issue[]) {
  if (!hasRule(rules, "COVER_INFO")) return;
  const cfg = ruleConfig(rules, "COVER_INFO");
  const sev = ruleSeverity(rules, "COVER_INFO", "INFO");
  const firstPart = docInfo.paragraphs
    .filter((p) => p.index <= 35)
    .map((p) => p.text)
    .join("\n");
  const text = toAsciiLower(firstPart);

  const checks: Array<{ enabled: boolean; pattern: RegExp; desc: string }> = [
    {
      enabled: parseYesNoLike(cfg.require_student_name, true),
      pattern: /(濮撳悕|name)/i,
      desc: "student name field missing on cover",
    },
    {
      enabled: parseYesNoLike(cfg.require_student_no, true),
      pattern: /(瀛﹀彿|student\s*id|student\s*no)/i,
      desc: "student number field missing on cover",
    },
    {
      enabled: parseYesNoLike(cfg.require_supervisor_1, true),
      pattern: /(鎸囧鏁欏笀|瀵煎笀|supervisor)/i,
      desc: "supervisor field missing on cover",
    },
    {
      enabled: parseYesNoLike(cfg.require_major, false),
      pattern: /(涓撲笟|major)/i,
      desc: "major field missing on cover",
    },
    {
      enabled: parseYesNoLike(cfg.require_college, false),
      pattern: /(瀛﹂櫌|college|school)/i,
      desc: "college field missing on cover",
    },
    {
      enabled: parseYesNoLike(cfg.require_class_name, false),
      pattern: /(鐝骇|class)/i,
      desc: "class field missing on cover",
    },
  ];

  for (const item of checks) {
    if (!item.enabled) continue;
    if (!item.pattern.test(text)) {
      issues.push(
        makeIssue({
          problemType: "cover_info",
          problemDesc: item.desc,
          position: "document",
          suggestion: "fill required cover fields",
          severity: sev,
          confidence: 0.72,
          issueStatus: "suspected",
          autoFix: false,
          reasons: ["low_confidence"],
        }),
      );
    }
  }
}

function capIssues(issues: Issue[], maxCount: number): Issue[] {
  if (issues.length <= maxCount) return issues;
  return issues.slice(0, maxCount);
}

function dedupeIssues(issues: Issue[]): Issue[] {
  const seen = new Set<string>();
  const out: Issue[] = [];
  for (const issue of issues) {
    const key = `${issue.problem_type}|${issue.problem_desc}|${issue.position}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(issue);
  }
  return out;
}

function computeScore(issues: Issue[]) {
  let errorCount = 0;
  let warningCount = 0;
  let infoCount = 0;
  let confirmedErrorCount = 0;
  let confirmedWarningCount = 0;
  let confirmedInfoCount = 0;
  let suspectedErrorCount = 0;
  let suspectedWarningCount = 0;
  let suspectedInfoCount = 0;
  let manualReviewCount = 0;

  for (const issue of issues) {
    if (issue.severity === "ERROR") errorCount += 1;
    else if (issue.severity === "WARNING") warningCount += 1;
    else infoCount += 1;

    if (issue.issue_status === "manual_review") {
      manualReviewCount += 1;
      continue;
    }
    if (issue.issue_status === "suspected") {
      if (issue.severity === "ERROR") suspectedErrorCount += 1;
      else if (issue.severity === "WARNING") suspectedWarningCount += 1;
      else suspectedInfoCount += 1;
      continue;
    }
    if (issue.severity === "ERROR") confirmedErrorCount += 1;
    else if (issue.severity === "WARNING") confirmedWarningCount += 1;
    else confirmedInfoCount += 1;
  }

  const penalty =
    Math.min(40, confirmedErrorCount * 2) +
    Math.min(20, confirmedWarningCount * 0.5) +
    Math.min(10, confirmedInfoCount * 0.1) +
    Math.min(15, suspectedErrorCount * 0.5) +
    Math.min(10, suspectedWarningCount * 0.2) +
    Math.min(5, suspectedInfoCount * 0.05);

  const score = Number(Math.max(0, 100 - penalty).toFixed(2));
  return {
    total_score: score,
    pass_flag: score >= 80 ? 1 : 0,
    error_count: errorCount,
    warning_count: warningCount,
    info_count: infoCount,
    hit_rule_count: issues.length,
    confirmed_error_count: confirmedErrorCount,
    confirmed_warning_count: confirmedWarningCount,
    confirmed_info_count: confirmedInfoCount,
    suspected_error_count: suspectedErrorCount,
    suspected_warning_count: suspectedWarningCount,
    suspected_info_count: suspectedInfoCount,
    manual_review_count: manualReviewCount,
  };
}

function enabledRuleCodes(rules: RuleRow[]): string[] {
  return rules.map((r) => String(r.rule_code || "").toUpperCase()).sort();
}

function formatUnknownError(error: unknown): string {
  if (error instanceof Error) return error.message || "unknown error";
  if (typeof error === "string") return error || "unknown error";
  if (typeof error === "number" || typeof error === "boolean") return String(error);
  if (error && typeof error === "object") {
    const e = error as Record<string, unknown>;
    const candidates = [e.message, e.error, e.code, e.details, e.hint]
      .map((x) => String(x || "").trim())
      .filter(Boolean);
    if (candidates.length) return candidates.join(" | ");
    try {
      return JSON.stringify(error);
    } catch {
      return "unknown object error";
    }
  }
  return "unknown error";
}

function runAllChecks(docInfo: DocInfo, rules: RuleRow[]): Issue[] {
  const issues: Issue[] = [];
  addBodyRules(docInfo, rules, issues);
  addPageRules(docInfo, rules, issues);
  addTocRules(docInfo, rules, issues);
  addHeadingRules(docInfo, rules, issues);
  addFigureTableRules(docInfo, rules, issues);
  addReferenceRules(docInfo, rules, issues);
  addCoverRules(docInfo, rules, issues);
  return capIssues(dedupeIssues(issues), 600);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { code: 405, message: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const bucket = Deno.env.get("SUPABASE_STORAGE_BUCKET") || "files";
  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { code: 500, message: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let taskId = 0;
  try {
    const payload = await req.json();
    taskId = Number(payload?.task_id || 0);
    if (!taskId) return json(400, { code: 400, message: "task_id is required" });

    const { data: task, error: taskError } = await supabase
      .from("detection_task")
      .select("id, paper_id, template_id, source_file_id")
      .eq("id", taskId)
      .maybeSingle();
    if (taskError) throw taskError;
    if (!task) return json(404, { code: 404, message: "Task not found" });

    const { data: sourceFile, error: sourceError } = await supabase
      .from("file_record")
      .select("id, storage_path")
      .eq("id", task.source_file_id)
      .maybeSingle();
    if (sourceError) throw sourceError;
    if (!sourceFile) return json(404, { code: 404, message: "Source file not found" });

    const objectPath = String(sourceFile.storage_path || "").replace(new RegExp(`^${bucket}/`), "");
    const { data: sourceBlob, error: downloadError } = await supabase.storage.from(bucket).download(objectPath);
    if (downloadError) throw downloadError;
    const docxBuffer = await sourceBlob.arrayBuffer();

    const zip = await JSZip.loadAsync(docxBuffer);
    const docXmlFile = zip.file("word/document.xml");
    if (!docXmlFile) return json(400, { code: 400, message: "Invalid docx: word/document.xml missing" });
    const documentXml = await docXmlFile.async("string");
    const stylesXml = (await zip.file("word/styles.xml")?.async("string")) || null;

    const { data: rules, error: ruleError } = await supabase
      .from("format_rule")
      .select("rule_code, severity, rule_config")
      .eq("template_id", task.template_id)
      .eq("enabled", 1);
    if (ruleError) throw ruleError;

    const docInfo = parseDocx(documentXml, stylesXml);
    const enabledRules = (rules || []) as RuleRow[];
    const issues = runAllChecks(docInfo, enabledRules);
    const metrics = computeScore(issues);
    const dbMetrics = {
      total_score: metrics.total_score,
      pass_flag: metrics.pass_flag,
      error_count: metrics.error_count,
      warning_count: metrics.warning_count,
      info_count: metrics.info_count,
      hit_rule_count: metrics.hit_rule_count,
    };

    const { error: resultError } = await supabase.from("detection_result").upsert(
      {
        task_id: task.id,
        ...dbMetrics,
        summary_json: {
          generated_by: "supabase_edge_function",
          analyzed_paragraph_count: docInfo.paragraphs.length,
          analyzed_section_count: docInfo.sections.length,
          enabled_rule_codes: enabledRuleCodes(enabledRules),
          score_breakdown: {
            confirmed_error_count: metrics.confirmed_error_count,
            confirmed_warning_count: metrics.confirmed_warning_count,
            confirmed_info_count: metrics.confirmed_info_count,
            suspected_error_count: metrics.suspected_error_count,
            suspected_warning_count: metrics.suspected_warning_count,
            suspected_info_count: metrics.suspected_info_count,
            manual_review_count: metrics.manual_review_count,
          },
        },
        detail_json: { issues },
        completed_at: new Date().toISOString(),
      },
      { onConflict: "task_id" },
    );
    if (resultError) throw resultError;

    const { error: taskDoneError } = await supabase
      .from("detection_task")
      .update({ status: "SUCCESS", progress: 100, finished_at: new Date().toISOString(), error_message: null })
      .eq("id", task.id);
    if (taskDoneError) throw taskDoneError;

    return json(200, {
      code: 0,
      message: "ok",
      data: {
        task_id: task.id,
        ...dbMetrics,
      },
    });
  } catch (error) {
    const message = formatUnknownError(error) || "detect failed";
    if (taskId) {
      await supabase
        .from("detection_task")
        .update({ status: "FAILED", progress: 100, finished_at: new Date().toISOString(), error_message: message })
        .eq("id", taskId);
    }
    return json(500, { code: 500, message });
  }
});

