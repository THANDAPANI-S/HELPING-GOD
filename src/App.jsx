import { useMemo, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import "./index.css";

/* =========================================================
   PDF WORKER
========================================================= */

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

/* =========================================================
   DEMO QUESTIONS
========================================================= */

const DEMO_QUESTIONS = [
  {
    question:
      "Illustrate the emerging trends in IoT and analyse the role of technologies such as AI, edge computing, cloud computing and intelligent automation in future IoT systems.",
    test: "TEST1",
  },
  {
    question:
      "Explain the features and basic architecture of Arduino boards and analyse their suitability for IoT sensing, monitoring and control applications.",
    test: "TEST1",
  },
  {
    question:
      "Summarize the major features of Raspberry Pi boards and analyse their suitability for IoT gateway, processing and application development.",
    test: "TEST1",
  },
  {
    question:
      "Analyse how sensor data can be processed to generate useful insights and support decision-making using IoT analytics.",
    test: "TEST1",
  },
  {
    question:
      "Evaluate the application of IoT in agriculture. Analyse how soil sensors, environmental sensors, communication systems, data processing and automated irrigation can support precision agriculture and resource management.",
    test: "TEST1",
  },

  {
    question:
      "Suggest a suitable processing approach and justify it briefly.",
    test: "TEST2",
  },
  {
    question:
      "Explain the interdependence of IoT devices, communication networks and cloud platforms.",
    test: "TEST2",
  },
  {
    question:
      "Explain processing in IoT and discuss its importance in IoT applications.",
    test: "TEST2",
  },
  {
    question:
      "Explain different data formats used in IoT systems with suitable examples.",
    test: "TEST2",
  },
  {
    question:
      "Explain the evolution of IoT and discuss the major technologies involved.",
    test: "TEST2",
  },
  {
    question:
      "Explain IoT analytics and discuss its applications in real-world systems.",
    test: "TEST2",
  },
  {
    question:
      "Describe the role of cloud computing in IoT architecture.",
    test: "TEST2",
  },
];

/* =========================================================
   TEXT HELPERS
========================================================= */

function normalizeText(text) {
  return String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function compactText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text) {
  return compactText(text)
    .split(" ")
    .filter((word) => word.length > 2);
}

/* =========================================================
   SIMILARITY
========================================================= */

function similarity(a, b) {
  const A = new Set(tokenize(a));
  const B = new Set(tokenize(b));

  if (!A.size || !B.size) {
    return 0;
  }

  let common = 0;

  A.forEach((word) => {
    if (B.has(word)) {
      common++;
    }
  });

  return common / Math.max(A.size, B.size);
}

/* =========================================================
   TEST DETECTION
========================================================= */

/*
  Important:
  Do NOT depend only on question text.

  Question Bank PDFs often contain:

  TEST | S.NO | UNIT | CHAP | TOPIC NAME | ...

  and a row may begin like:

  1  1  1  ...
  2  1  1  ...

  Therefore we support both explicit TEST markers
  and table-row based TEST detection.
*/

function detectExplicitTest(text) {
  const value = String(text || "");

  if (
    /\bTEST\s*1\b/i.test(value) ||
    /\bTEST1\b/i.test(value) ||
    /\bTEST[-_\s]*01\b/i.test(value)
  ) {
    return "TEST1";
  }

  if (
    /\bTEST\s*2\b/i.test(value) ||
    /\bTEST2\b/i.test(value) ||
    /\bTEST[-_\s]*02\b/i.test(value)
  ) {
    return "TEST2";
  }

  return "UNKNOWN";
}

/*
  Detect rows where the first column is the test number.

  Examples:
  1 1 1 Evolution of IoT
  2 1 1 Processing in IoT
  1 2 1 Arduino
  2 3 1 Data Formats

  We only use this aggressively after a Question Bank
  table header has been detected.
*/

function detectTableTest(line) {
  const text = String(line || "")
    .replace(/\u00a0/g, " ")
    .trim();

  if (!text) {
    return "UNKNOWN";
  }

  const explicit = detectExplicitTest(text);

  if (explicit !== "UNKNOWN") {
    return explicit;
  }

  /*
    First numeric token followed by another numeric token.
  */

  const match = text.match(
    /^([12])\s+(?:\d+|[A-Z])(?:\s+|$)/
  );

  if (match) {
    return match[1] === "1"
      ? "TEST1"
      : "TEST2";
  }

  /*
    Some PDFs produce:
    1. 1 1 ...
    2. 1 1 ...
  */

  const dottedMatch = text.match(
    /^([12])[\.\-:]\s+\d+\s+(?:\d+|[A-Z])(?:\s+|$)/
  );

  if (dottedMatch) {
    return dottedMatch[1] === "1"
      ? "TEST1"
      : "TEST2";
  }

  return "UNKNOWN";
}

/* =========================================================
   TOPIC DETECTION
========================================================= */

function detectTopic(question) {
  const q = compactText(question);

  const topics = [
    ["future trends", "Future Trends"],
    ["iot trends", "Future Trends"],
    ["emerging trends", "Future Trends"],

    ["arduino", "Arduino"],

    ["raspberry pi", "Raspberry Pi"],

    ["soil sensor", "Agricultural IoT"],
    ["precision agriculture", "Agricultural IoT"],
    ["agriculture", "Agricultural IoT"],

    ["sensor", "Sensors"],

    ["iot analytics", "IoT Analytics"],
    ["analytics", "IoT Analytics"],

    ["data format", "Data Formats"],
    ["data formats", "Data Formats"],

    ["processing", "IoT Processing"],

    ["evolution", "Evolution of IoT"],

    ["cloud computing", "Cloud Computing"],
    ["cloud", "Cloud Computing"],

    ["edge computing", "Edge Computing"],

    ["communication", "Communication"],

    ["network", "Networking"],

    ["security", "IoT Security"],

    ["gateway", "IoT Gateway"],

    ["automation", "Automation"],

    ["architecture", "IoT Architecture"],
  ];

  for (const [key, topic] of topics) {
    if (q.includes(key)) {
      return topic;
    }
  }

  const words = tokenize(question);

  return (
    words.slice(0, 2).join(" ") ||
    "General"
  );
}

/* =========================================================
   NOISE DETECTION
========================================================= */

function isNoiseLine(line) {
  const text = String(line || "").trim();

  if (!text) {
    return true;
  }

  const lower = text.toLowerCase();

  const noisePatterns = [
    "printequestions.php",
    "printquestions.php",
    "/apps/examportal/",
    "examportal",
    "question bank suggest",
    "page ",
    "www.",
    "http://",
    "https://",
    "localhost",
    "generated on",
    "student name",
    "signature",
    "maximum marks",
    "max marks",
    "model question paper",
    "section 1",
    "section 2",
  ];

  if (
    noisePatterns.some((pattern) =>
      lower.includes(pattern)
    )
  ) {
    return true;
  }

  /*
    URL query strings
  */

  if (
    /[?&]q=[A-Za-z0-9+/=_-]{10,}/i.test(
      text
    )
  ) {
    return true;
  }

  /*
    Question Bank table header
  */

  if (
    /test\s*s\.?\s*no/i.test(text) &&
    /unit/i.test(text)
  ) {
    return true;
  }

  if (
    /chap\.?/i.test(text) &&
    /topic\s*name/i.test(text)
  ) {
    return true;
  }

  /*
    Mostly numeric metadata
  */

  const letters = (
    text.match(/[A-Za-z]/g) || []
  ).length;

  const digits = (
    text.match(/[0-9]/g) || []
  ).length;

  if (
    digits > letters * 2 &&
    letters < 25
  ) {
    return true;
  }

  return false;
}

/* =========================================================
   QUESTION CLEANING
========================================================= */

function cleanQuestionText(raw) {
  let text = String(raw || "");

  /*
    Remove URLs.
  */

  text = text.replace(
    /https?:\/\/\S+/gi,
    " "
  );

  text = text.replace(
    /\/apps\/examportal\/admin\/PrintQuestions\.php\?\S*/gi,
    " "
  );

  text = text.replace(
    /100\/apps\/examportal\/admin\/PrintQuestions\.php\??/gi,
    " "
  );

  text = text.replace(
    /\bq=[A-Za-z0-9+/=_-]+\b/gi,
    " "
  );

  /*
    Remove dates.
  */

  text = text.replace(
    /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
    " "
  );

  /*
    Remove times.
  */

  text = text.replace(
    /\b\d{1,2}:\d{2}\s*(?:AM|PM)?\b/gi,
    " "
  );

  /*
    Remove Question Bank IDs.
  */

  text = text.replace(
    /\b\d{4}_[A-Z0-9_]+_Question\s+Bank\b/gi,
    " "
  );

  /*
    Remove explicit TEST labels.
  */

  text = text.replace(
    /\bTEST\s*(?:1|2)\b/gi,
    " "
  );

  /*
    Remove common metadata.
  */

  text = text.replace(
    /\bCO\s*\d+\b/gi,
    " "
  );

  text = text.replace(
    /\bS\.?\s*NO\.?\b/gi,
    " "
  );

  text = text.replace(
    /\bMARK\s*CODE\b/gi,
    " "
  );

  text = text.replace(
    /\bQ\.?\s*TYPE\b/gi,
    " "
  );

  /*
    Remove metadata number groups.

    Example:
    2024 1 1 1 1 Explain ...

    We do not remove every number globally because
    numbers can legitimately occur in questions.
  */

  text = text.replace(
    /^\s*[12]\s+\d+\s+\d+\s+/,
    ""
  );

  text = text.replace(
    /^\s*[12][\.\-:]\s+\d+\s+\d+\s+/,
    ""
  );

  /*
    Remove leading question number.
  */

  text = text.replace(
    /^\s*(?:question|ques|q)?\s*\d+\s*[\).:\-]?\s*/i,
    ""
  );

  text = text.replace(
    /^\s*[-•*]\s*/,
    ""
  );

  /*
    Remove obvious portal fragments.
  */

  text = text.replace(
    /\b2024_[A-Z0-9_]+\b/gi,
    " "
  );

  /*
    Remove repeated metadata words.
  */

  text = text.replace(
    /\bQuestion\s+Bank\b/gi,
    " "
  );

  /*
    Clean whitespace.
  */

  text = text
    .replace(/\s+/g, " ")
    .replace(/\s+([?.!,;:])/g, "$1")
    .trim();

  return text;
}

/* =========================================================
   VALID QUESTION
========================================================= */

function looksLikeQuestion(text) {
  const q = cleanQuestionText(text);

  if (q.length < 15) {
    return false;
  }

  if (q.length > 900) {
    return false;
  }

  if (isNoiseLine(q)) {
    return false;
  }

  const lower = q.toLowerCase();

  const questionWords = [
    "explain",
    "define",
    "describe",
    "discuss",
    "analyse",
    "analyze",
    "compare",
    "evaluate",
    "summarize",
    "suggest",
    "justify",
    "what",
    "how",
    "why",
    "identify",
    "differentiate",
    "illustrate",
    "examine",
    "list",
    "state",
    "write",
    "outline",
    "elaborate",
    "mention",
  ];

  const hasQuestionWord =
    questionWords.some((word) =>
      lower.startsWith(word)
    ) ||
    questionWords.some((word) =>
      lower.includes(` ${word} `)
    );

  const hasQuestionMark =
    q.includes("?");

  /*
    Strong question words are preferred,
    but real question-bank questions may
    not contain them in the first position.
  */

  return (
    hasQuestionWord ||
    hasQuestionMark ||
    q.length >= 35
  );
}

/* =========================================================
   REMOVE TABLE METADATA FROM START
========================================================= */

function removeTablePrefix(text) {
  let value = String(text || "").trim();

  /*
    TEST S.NO UNIT style:
    1 1 1 1 1 Explain...
  */

  value = value.replace(
    /^\s*[12]\s+\d+\s+\d+\s+\d+\s+\d+\s+/,
    ""
  );

  /*
    Sometimes only 3 numeric columns appear.
  */

  value = value.replace(
    /^\s*[12]\s+\d+\s+\d+\s+/,
    ""
  );

  /*
    Dotted row.
  */

  value = value.replace(
    /^\s*[12][\.\-:]\s+\d+\s+\d+\s+/,
    ""
  );

  return value.trim();
}

/* =========================================================
   QUESTION BLOCK EXTRACTION
========================================================= */

function extractQuestionBlocks(text) {
  const normalized =
    normalizeText(text);

  const rawLines =
    normalized
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

  const results = [];

  let currentTest = "UNKNOWN";
  let tableMode = false;

  let currentBuffer = "";
  let currentBufferTest = "UNKNOWN";

  function flush() {
    if (!currentBuffer.trim()) {
      return;
    }

    let cleaned =
      removeTablePrefix(
        currentBuffer
      );

    cleaned =
      cleanQuestionText(cleaned);

    if (
      looksLikeQuestion(cleaned)
    ) {
      results.push({
        question: cleaned,
        test:
          currentBufferTest !==
          "UNKNOWN"
            ? currentBufferTest
            : currentTest,
      });
    }

    currentBuffer = "";
    currentBufferTest = "UNKNOWN";
  }

  for (const rawLine of rawLines) {
    const line =
      rawLine.trim();

    if (!line) {
      continue;
    }

    /*
      Detect Question Bank table header.
    */

    const isTableHeader =
      /test\s*s\.?\s*no/i.test(line) &&
      /unit/i.test(line);

    if (isTableHeader) {
      flush();
      tableMode = true;
      continue;
    }

    /*
      Explicit TEST 1 / TEST 2.
    */

    const explicitTest =
      detectExplicitTest(line);

    if (
      explicitTest !==
      "UNKNOWN"
    ) {
      /*
        Do not use "TEST S.NO" as a marker.
      */

      if (
        /\bTEST\s*(?:1|2)\b/i.test(
          line
        ) ||
        /\bTEST[12]\b/i.test(line)
      ) {
        currentTest =
          explicitTest;
      }
    }

    /*
      If we are in table mode, inspect
      the first column.
    */

    let tableTest =
      "UNKNOWN";

    if (tableMode) {
      tableTest =
        detectTableTest(line);
    }

    /*
      A new table row.
    */

    const startsTableRow =
      tableMode &&
      (
        /^\s*[12]\s+\d+\s+\d+/.test(
          line
        ) ||
        /^\s*[12][\.\-:]\s+\d+\s+\d+/.test(
          line
        )
      );

    if (startsTableRow) {
      flush();

      currentBufferTest =
        tableTest !== "UNKNOWN"
          ? tableTest
          : currentTest;

      /*
        Remove the table columns.
      */

      currentBuffer =
        removeTablePrefix(
          line
        );

      continue;
    }

    /*
      Normal numbered question.
    */

    const startsNumber =
      /^\d+\s*[\).:-]\s+/.test(
        line
      );

    if (startsNumber) {
      /*
        In table mode a normal number may
        actually be a question serial number.

        We only start a question if the
        cleaned content looks like a question.
      */

      const withoutNumber =
        line.replace(
          /^\d+\s*[\).:-]\s+/,
          ""
        );

      const cleaned =
        cleanQuestionText(
          withoutNumber
        );

      if (
        looksLikeQuestion(cleaned)
      ) {
        flush();

        currentBuffer =
          cleaned;

        currentBufferTest =
          tableTest !==
          "UNKNOWN"
            ? tableTest
            : currentTest;

        continue;
      }
    }

    /*
      Ignore pure metadata.
    */

    if (isNoiseLine(line)) {
      continue;
    }

    /*
      If line itself is a question,
      start a new question.
    */

    const cleanedLine =
      cleanQuestionText(line);

    if (
      looksLikeQuestion(
        cleanedLine
      )
    ) {
      if (currentBuffer) {
        /*
          If the previous buffer already has
          enough content, finish it.
        */

        if (
          currentBuffer.length >
          25
        ) {
          flush();
        }
      }

      if (!currentBuffer) {
        currentBuffer =
          cleanedLine;

        currentBufferTest =
          tableTest !==
          "UNKNOWN"
            ? tableTest
            : currentTest;
      } else {
        currentBuffer +=
          " " + cleanedLine;
      }
    } else if (
      currentBuffer
    ) {
      /*
        Continuation line.
      */

      currentBuffer +=
        " " + cleanedLine;
    }
  }

  flush();

  /*
    FALLBACK:
    If table parsing did not work,
    split using common question verbs.
  */

  if (
    results.length < 2
  ) {
    const chunks =
      normalized
        .split(
          /(?<=[?.])\s+(?=(?:Explain|Define|Describe|Discuss|Analyse|Analyze|Compare|Evaluate|Suggest|What|How|Why|Identify|Differentiate|Illustrate|Examine|Summarize|Evaluate)\b)/i
        )
        .map((item) =>
          cleanQuestionText(item)
        )
        .filter(
          (item) =>
            looksLikeQuestion(item)
        );

    if (
      chunks.length >
      results.length
    ) {
      return chunks.map(
        (question) => ({
          question,
          test:
            detectExplicitTest(
              question
            ),
        })
      );
    }
  }

  return results;
}

/* =========================================================
   PROCESS QUESTION BANK
========================================================= */

function processQuestionBank(
  rawItems
) {
  const cleaned = [];

  for (
    const item of rawItems
  ) {
    const rawQuestion =
      typeof item === "string"
        ? item
        : item.question;

    let question =
      cleanQuestionText(
        rawQuestion
      );

    question =
      removeTablePrefix(
        question
      );

    if (
      !looksLikeQuestion(
        question
      )
    ) {
      continue;
    }

    let test =
      typeof item === "string"
        ? detectExplicitTest(
            item
          )
        : item.test ||
          "UNKNOWN";

    /*
      Final attempt to detect test from
      the original/raw question.
    */

    if (
      test === "UNKNOWN"
    ) {
      test =
        detectTableTest(
          rawQuestion
        );
    }

    /*
      Final attempt from question text.
    */

    if (
      test === "UNKNOWN"
    ) {
      test =
        detectExplicitTest(
          rawQuestion
        );
    }

    /*
      Duplicate detection.
    */

    const duplicate =
      cleaned.find(
        (existing) => {
          const score =
            similarity(
              existing.question,
              question
            );

          return (
            score >= 0.82
          );
        }
      );

    if (duplicate) {
      /*
        If duplicate exists but the new
        copy has a known test, preserve
        the known classification.
      */

      if (
        duplicate.test ===
          "UNKNOWN" &&
        test !== "UNKNOWN"
      ) {
        duplicate.test = test;
      }

      continue;
    }

    cleaned.push({
      id:
        cleaned.length + 1,

      question,

      test:
        test === "TEST1" ||
        test === "TEST2"
          ? test
          : "UNKNOWN",

      topic:
        detectTopic(
          question
        ),
    });
  }

  return cleaned;
}

/* =========================================================
   ANALYSIS
========================================================= */

function analyseQuestions(
  questionBank
) {
  return questionBank.map(
    (item, index) => {
      let repetition = 1;

      questionBank.forEach(
        (
          other,
          otherIndex
        ) => {
          if (
            index ===
            otherIndex
          ) {
            return;
          }

          if (
            similarity(
              item.question,
              other.question
            ) >= 0.42
          ) {
            repetition++;
          }
        }
      );

      const topicFrequency =
        questionBank.filter(
          (q) =>
            q.topic ===
            item.topic
        ).length;

      const importantWord =
        /(explain|discuss|compare|describe|algorithm|applications|advantages|difference|types|working|analyse|analyze|evaluate|justify|illustrate|summarize)/i.test(
          item.question
        );

      const repetitionScore =
        Math.min(
          repetition * 15,
          40
        );

      const topicScore =
        Math.min(
          topicFrequency * 5,
          25
        );

      const wordingScore =
        importantWord
          ? 15
          : 5;

      const priority =
        Math.min(
          100,
          20 +
            repetitionScore +
            topicScore +
            wordingScore
        );

      return {
        ...item,
        repetition,
        priority,
      };
    }
  );
}

/* =========================================================
   PATTERN PARSER
========================================================= */

function parsePattern(
  patternText
) {
  return String(
    patternText || ""
  )
    .split("\n")
    .map((line) =>
      line.trim()
    )
    .filter(Boolean)
    .map((line) => {
      const match =
        line.match(
          /(\d+)\s*[x×*]\s*(\d+)\s*=\s*(\d+)/
        );

      if (!match) {
        return null;
      }

      return {
        count:
          Number(match[1]),

        marks:
          Number(match[2]),

        total:
          Number(match[3]),
      };
    })
    .filter(Boolean);
}

function getTotalMarks(
  patterns
) {
  return patterns.reduce(
    (sum, item) =>
      sum + item.total,
    0
  );
}

/* =========================================================
   PAPER GENERATOR
========================================================= */

function generatePaper(
  questionBank,
  patterns,
  seed
) {
  if (
    !questionBank.length
  ) {
    return [];
  }

  const shuffled =
    [...questionBank].sort(
      (a, b) => {
        const randomA =
          Math.sin(
            a.id *
              999 +
              seed *
                17
          );

        const randomB =
          Math.sin(
            b.id *
              999 +
              seed *
                17
          );

        return (
          b.priority +
          randomB * 5 -
          (a.priority +
            randomA * 5)
        );
      }
    );

  const used =
    new Set();

  let pointer = 0;

  function getNextQuestion() {
    for (
      let i = 0;
      i <
      shuffled.length;
      i++
    ) {
      const candidate =
        shuffled[
          (pointer + i) %
            shuffled.length
        ];

      if (
        !used.has(
          candidate.id
        )
      ) {
        used.add(
          candidate.id
        );

        pointer =
          (pointer +
            i +
            1) %
          shuffled.length;

        return candidate;
      }
    }

    /*
      Fallback only if pattern requires
      more questions than available.
    */

    const fallback =
      shuffled[
        pointer %
          shuffled.length
      ];

    pointer++;

    return fallback;
  }

  return patterns.map(
    (
      section,
      sectionIndex
    ) => {
      const questions =
        [];

      for (
        let i = 0;
        i <
        section.count;
        i++
      ) {
        questions.push(
          getNextQuestion()
        );
      }

      return {
        sectionNumber:
          sectionIndex + 1,

        count:
          section.count,

        marks:
          section.marks,

        total:
          section.total,

        questions,
      };
    }
  );
}

/* =========================================================
   PDF LINE EXTRACTION
========================================================= */

/*
  This is one of the biggest fixes.

  The old code appended PDF items directly.
  That can scramble columns.

  Here we:
  1. Read every text item.
  2. Group items by Y coordinate.
  3. Sort each line from left -> right.
  4. Rebuild readable rows.
*/

async function extractPdfLines(
  file
) {
  const arrayBuffer =
    await file.arrayBuffer();

  const pdf =
    await pdfjsLib.getDocument(
      {
        data: new Uint8Array(
          arrayBuffer
        ),
      }
    ).promise;

  const allLines = [];

  for (
    let pageNumber = 1;
    pageNumber <=
    pdf.numPages;
    pageNumber++
  ) {
    const page =
      await pdf.getPage(
        pageNumber
      );

    const content =
      await page.getTextContent();

    const items =
      content.items
        .map((item) => {
          const transform =
            item.transform || [];

          return {
            text: String(
              item.str || ""
            ).trim(),

            x:
              Number(
                transform[4] || 0
              ),

            y:
              Number(
                transform[5] || 0
              ),

            width:
              Number(
                item.width || 0
              ),
          };
        })
        .filter(
          (item) =>
            item.text
        );

    /*
      Group by approximate Y.
    */

    const rows = [];

    for (
      const item of items
    ) {
      let row =
        rows.find(
          (r) =>
            Math.abs(
              r.y -
                item.y
            ) < 3.5
        );

      if (!row) {
        row = {
          y: item.y,
          items: [],
        };

        rows.push(row);
      }

      row.items.push(
        item
      );
    }

    /*
      PDF coordinates normally start from
      bottom, so sort descending Y.
    */

    rows.sort(
      (a, b) =>
        b.y - a.y
    );

    for (
      const row of rows
    ) {
      row.items.sort(
        (a, b) =>
          a.x - b.x
      );

      let line = "";

      let lastRight =
        null;

      for (
        const item of row.items
      ) {
        const start =
          item.x;

        const gap =
          lastRight ===
          null
            ? 0
            : start -
              lastRight;

        /*
          Insert spacing between
          separate PDF columns.
        */

        if (
          line &&
          gap > 2
        ) {
          line += " ";
        }

        line += item.text;

        lastRight =
          item.x +
          item.width;
      }

      if (
        line.trim()
      ) {
        allLines.push(
          line.trim()
        );
      }
    }
  }

  return allLines;
}

/* =========================================================
   FILE EXTRACTION
========================================================= */

async function extractFileText(
  file
) {
  const extension =
    file.name
      .split(".")
      .pop()
      .toLowerCase();

  /*
    TXT / CSV
  */

  if (
    extension === "txt" ||
    extension === "csv"
  ) {
    return await file.text();
  }

  /*
    DOCX
  */

  if (
    extension === "docx"
  ) {
    const mammoth =
      await import(
        "mammoth"
      );

    const buffer =
      await file.arrayBuffer();

    const result =
      await mammoth.extractRawText(
        {
          arrayBuffer:
            buffer,
        }
      );

    return result.value;
  }

  /*
    PDF

    First use coordinate-aware extraction.
  */

  if (
    extension === "pdf"
  ) {
    const lines =
      await extractPdfLines(
        file
      );

    return lines.join(
      "\n"
    );
  }

  throw new Error(
    "Please upload PDF, DOCX, TXT or CSV."
  );
}

/* =========================================================
   MAIN APP
========================================================= */

function App() {
  const fileInputRef =
    useRef(null);

  const [
    questionBank,
    setQuestionBank,
  ] = useState([]);

  const [
    subject,
    setSubject,
  ] = useState(
    "Data and Information Security"
  );

  const [
    college,
    setCollege,
  ] = useState(
    "MODEL QUESTION PAPER"
  );

  const [
    examTime,
    setExamTime,
  ] = useState(
    "1.5 Hours"
  );

  const [
    patternText,
    setPatternText,
  ] = useState(
    "5 × 2 = 10\n4 × 5 = 20\n2 × 10 = 20"
  );

  const [
    selectedTest,
    setSelectedTest,
  ] = useState("BOTH");

  const [
    paper,
    setPaper,
  ] = useState([]);

  const [
    activePage,
    setActivePage,
  ] = useState(
    "dashboard"
  );

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    fileName,
    setFileName,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  const [
    generationNumber,
    setGenerationNumber,
  ] = useState(0);

  /* =======================================================
     TEST COUNTS
  ======================================================= */

  const test1Count =
    useMemo(
      () =>
        questionBank.filter(
          (q) =>
            q.test ===
            "TEST1"
        ).length,
      [questionBank]
    );

  const test2Count =
    useMemo(
      () =>
        questionBank.filter(
          (q) =>
            q.test ===
            "TEST2"
        ).length,
      [questionBank]
    );

  const unknownCount =
    useMemo(
      () =>
        questionBank.filter(
          (q) =>
            q.test ===
            "UNKNOWN"
        ).length,
      [questionBank]
    );

  /* =======================================================
     FILTER QUESTIONS
  ======================================================= */

  const filteredQuestions =
    useMemo(() => {
      if (
        selectedTest ===
        "BOTH"
      ) {
        return questionBank;
      }

      return questionBank.filter(
        (item) =>
          item.test ===
          selectedTest
      );
    }, [
      questionBank,
      selectedTest,
    ]);

  /* =======================================================
     PATTERN
  ======================================================= */

  const patterns =
    useMemo(
      () =>
        parsePattern(
          patternText
        ),
      [patternText]
    );

  const totalMarks =
    useMemo(
      () =>
        getTotalMarks(
          patterns
        ),
      [patterns]
    );

  /* =======================================================
     ANALYSIS
  ======================================================= */

  const analysedQuestions =
    useMemo(
      () =>
        analyseQuestions(
          filteredQuestions
        ),
      [filteredQuestions]
    );

  const importantQuestions =
    useMemo(
      () =>
        [
          ...analysedQuestions,
        ].sort(
          (a, b) =>
            b.priority -
            a.priority
        ),
      [analysedQuestions]
    );

  /* =======================================================
     TOPICS
  ======================================================= */

  const topicData =
    useMemo(() => {
      const data = {};

      analysedQuestions.forEach(
        (question) => {
          data[
            question.topic
          ] =
            (data[
              question.topic
            ] || 0) + 1;
        }
      );

      return Object.entries(
        data
      ).sort(
        (a, b) =>
          b[1] - a[1]
      );
    }, [
      analysedQuestions,
    ]);

  /* =======================================================
     LOAD DEMO
  ======================================================= */

  function loadDemo() {
    const processed =
      processQuestionBank(
        DEMO_QUESTIONS
      );

    setQuestionBank(
      processed
    );

    setFileName(
      "Demo Question Bank"
    );

    setPaper([]);

    setError("");

    setSelectedTest(
      "BOTH"
    );
  }

  /* =======================================================
     UPLOAD
  ======================================================= */

  async function handleUpload(
    event
  ) {
    const file =
      event.target
        ?.files?.[0];

    if (!file) {
      return;
    }

    setLoading(true);
    setError("");
    setFileName(
      file.name
    );

    try {
      /*
        Extract raw text.
      */

      const text =
        await extractFileText(
          file
        );

      console.log(
        "========== RAW EXTRACTED TEXT =========="
      );

      console.log(text);

      /*
        Extract questions.
      */

      const rawQuestions =
        extractQuestionBlocks(
          text
        );

      console.log(
        "========== RAW QUESTION BLOCKS =========="
      );

      console.table(
        rawQuestions
      );

      /*
        Process + classify.
      */

      const processed =
        processQuestionBank(
          rawQuestions
        );

      console.log(
        "========== FINAL QUESTION BANK =========="
      );

      console.table(
        processed.map(
          (q) => ({
            id: q.id,
            test: q.test,
            topic: q.topic,
            question:
              q.question,
          })
        )
      );

      if (
        !processed.length
      ) {
        throw new Error(
          "No actual questions could be detected. Please check the PDF format."
        );
      }

      setQuestionBank(
        processed
      );

      setPaper([]);

      setSelectedTest(
        "BOTH"
      );

      setActivePage(
        "dashboard"
      );

      /*
        Helpful classification message.
      */

      const t1 =
        processed.filter(
          (q) =>
            q.test ===
            "TEST1"
        ).length;

      const t2 =
        processed.filter(
          (q) =>
            q.test ===
            "TEST2"
        ).length;

      const unknown =
        processed.filter(
          (q) =>
            q.test ===
            "UNKNOWN"
        ).length;

      if (
        unknown > 0
      ) {
        setError(
          `Loaded ${processed.length} questions: TEST 1 = ${t1}, TEST 2 = ${t2}, Unclassified = ${unknown}. Open browser console (F12) to inspect extracted rows.`
        );
      }
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          "Unable to read the uploaded file."
      );
    } finally {
      setLoading(
        false
      );

      if (
        fileInputRef.current
      ) {
        fileInputRef.current.value =
          "";
      }
    }
  }

  /* =======================================================
     GENERATE PAPER
  ======================================================= */

  function generateQuestionPaper() {
    setError("");

    if (
      !questionBank.length
    ) {
      setError(
        "Upload a question bank or load demo questions first."
      );
      return;
    }

    if (
      !filteredQuestions.length
    ) {
      setError(
        `No questions found for ${selectedTest}. Try BOTH or check the question bank classification.`
      );
      return;
    }

    if (
      !patterns.length
    ) {
      setError(
        "Enter a valid pattern. Example: 5 × 2 = 10"
      );
      return;
    }

    const requiredQuestions =
      patterns.reduce(
        (
          sum,
          section
        ) =>
          sum +
          section.count,
        0
      );

    if (
      filteredQuestions.length <
      requiredQuestions
    ) {
      setError(
        `Your selected test has only ${filteredQuestions.length} usable questions, but the pattern needs ${requiredQuestions}.`
      );
      return;
    }

    const nextGeneration =
      generationNumber +
      1;

    const generated =
      generatePaper(
        analysedQuestions,
        patterns,
        nextGeneration
      );

    setPaper(
      generated
    );

    setGenerationNumber(
      nextGeneration
    );

    setActivePage(
      "paper"
    );
  }

  /* =======================================================
     ANOTHER SET
  ======================================================= */

  function generateAnotherPaper() {
    if (
      !analysedQuestions.length
    ) {
      return;
    }

    const nextGeneration =
      generationNumber +
      1;

    const generated =
      generatePaper(
        analysedQuestions,
        patterns,
        nextGeneration
      );

    setPaper(
      generated
    );

    setGenerationNumber(
      nextGeneration
    );
  }

  /* =======================================================
     DOWNLOAD PDF
  ======================================================= */

  function downloadPDF() {
    if (
      !paper.length
    ) {
      return;
    }

    const doc =
      new jsPDF();

    const pageWidth =
      doc.internal
        .pageSize
        .getWidth();

    const pageHeight =
      doc.internal
        .pageSize
        .getHeight();

    let y = 20;

    function addWrappedText(
      text,
      x,
      currentY,
      width,
      lineHeight = 6
    ) {
      const lines =
        doc.splitTextToSize(
          text,
          width
        );

      for (
        const line of lines
      ) {
        if (
          currentY >
          pageHeight -
            20
        ) {
          doc.addPage();

          currentY = 20;
        }

        doc.text(
          line,
          x,
          currentY
        );

        currentY +=
          lineHeight;
      }

      return currentY;
    }

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setFontSize(
      16
    );

    doc.text(
      college.toUpperCase(),
      pageWidth / 2,
      y,
      {
        align:
          "center",
      }
    );

    y += 9;

    doc.setFontSize(
      13
    );

    doc.text(
      "MODEL QUESTION PAPER",
      pageWidth / 2,
      y,
      {
        align:
          "center",
      }
    );

    y += 12;

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.setFontSize(
      10
    );

    doc.text(
      `Subject: ${subject}`,
      15,
      y
    );

    doc.text(
      `Time: ${examTime}`,
      pageWidth - 55,
      y
    );

    y += 7;

    doc.text(
      `Maximum Marks: ${totalMarks}`,
      15,
      y
    );

    y += 10;

    doc.line(
      15,
      y,
      pageWidth - 15,
      y
    );

    y += 10;

    let globalNumber =
      1;

    paper.forEach(
      (section) => {
        doc.setFont(
          "helvetica",
          "bold"
        );

        doc.setFontSize(
          12
        );

        y =
          addWrappedText(
            `SECTION ${section.sectionNumber}`,
            15,
            y,
            pageWidth -
              30,
            7
          );

        doc.setFontSize(
          10
        );

        doc.text(
          `${section.count} × ${section.marks} = ${section.total}`,
          pageWidth -
            55,
          y - 7
        );

        y += 5;

        doc.setFont(
          "helvetica",
          "normal"
        );

        section.questions.forEach(
          (question) => {
            y =
              addWrappedText(
                `${globalNumber}. ${question.question}`,
                18,
                y,
                pageWidth -
                  33,
                6
              );

            y += 3;

            globalNumber++;
          }
        );

        y += 5;
      }
    );

    doc.setFontSize(
      8
    );

    doc.text(
      "Generated by Exam Predict AI",
      pageWidth / 2,
      pageHeight - 8,
      {
        align:
          "center",
      }
    );

    const safeName =
      subject
        .replace(
          /[^\w]+/g,
          "-"
        )
        .toLowerCase();

    doc.save(
      `${safeName}-question-paper.pdf`
    );
  }

  /* =======================================================
     PRINT
  ======================================================= */

  function printPaper() {
    window.print();
  }

  /* =======================================================
     UI
  ======================================================= */

  return (
    <div className="app">

      {/* HEADER */}

      <header className="topbar">

        <div>
          <div className="brand">
            EXAM
            <span>
              PREDICT
            </span>
          </div>

          <div className="tagline">
            AI-powered question
            paper generator
          </div>
        </div>

        <div className="header-badge">
          {
            filteredQuestions.length
          }{" "}
          Questions
        </div>

      </header>

      {/* MAIN */}

      <main className="container">

        {/* HERO */}

        <section className="hero">

          <div>

            <p className="eyebrow">
              SMART EXAM
              PREPARATION
            </p>

            <h1>
              Turn your question
              bank into an
              <span>
                {" "}
                intelligent model
                paper.
              </span>
            </h1>

            <p className="hero-text">
              Upload your previous
              question bank, select
              TEST 1, TEST 2 or BOTH,
              analyse important
              questions and generate
              your exact exam pattern.
            </p>

          </div>

        </section>

        {/* NAVIGATION */}

        <div className="tabs">

          <button
            className={
              activePage ===
              "dashboard"
                ? "tab active"
                : "tab"
            }
            onClick={() =>
              setActivePage(
                "dashboard"
              )
            }
          >
            Dashboard
          </button>

          <button
            className={
              activePage ===
              "important"
                ? "tab active"
                : "tab"
            }
            onClick={() =>
              setActivePage(
                "important"
              )
            }
          >
            Important
            Questions
          </button>

          <button
            className={
              activePage ===
              "paper"
                ? "tab active"
                : "tab"
            }
            onClick={() =>
              setActivePage(
                "paper"
              )
            }
          >
            Question Paper
          </button>

        </div>

        {/* ERROR / STATUS */}

        {error && (
          <div className="error">
            ⚠️ {error}
          </div>
        )}

        {/* =================================================
            DASHBOARD
        ================================================= */}

        {activePage ===
          "dashboard" && (
          <>

            <section className="grid">

              {/* UPLOAD */}

              <div className="card upload-card">

                <div className="card-title">
                  📚 Question Bank
                </div>

                <p>
                  Upload previous
                  questions in PDF,
                  DOCX, TXT or CSV.
                </p>

                <input
                  ref={
                    fileInputRef
                  }
                  type="file"
                  accept=".pdf,.docx,.txt,.csv"
                  hidden
                  onChange={
                    handleUpload
                  }
                />

                <button
                  className="primary-button"
                  disabled={
                    loading
                  }
                  onClick={() =>
                    fileInputRef.current?.click()
                  }
                >
                  {loading
                    ? "Analysing PDF..."
                    : "Upload Question Bank"}
                </button>

                <button
                  className="secondary-button"
                  onClick={
                    loadDemo
                  }
                >
                  Load Demo
                  Questions
                </button>

                {fileName && (
                  <div className="file-name">
                    ✓{" "}
                    {fileName}
                  </div>
                )}

              </div>

              {/* EXAM DETAILS */}

              <div className="card">

                <div className="card-title">
                  ⚙️ Exam Details
                </div>

                <label>
                  College /
                  Institution
                </label>

                <input
                  value={
                    college
                  }
                  onChange={(e) =>
                    setCollege(
                      e.target
                        .value
                    )
                  }
                />

                <label>
                  Subject
                </label>

                <input
                  value={
                    subject
                  }
                  onChange={(e) =>
                    setSubject(
                      e.target
                        .value
                    )
                  }
                />

                <label>
                  Exam Duration
                </label>

                <input
                  value={
                    examTime
                  }
                  onChange={(e) =>
                    setExamTime(
                      e.target
                        .value
                    )
                  }
                />

              </div>

            </section>

            {/* =================================================
                TEST FILTER
            ================================================= */}

            <section className="card">

              <div className="card-title">
                🎯 Question Source
              </div>

              <p>
                Select which test should
                be used for analysis and
                paper generation.
              </p>

              <div className="test-selector">

                <button
                  className={
                    selectedTest ===
                    "TEST1"
                      ? "test-option selected"
                      : "test-option"
                  }
                  onClick={() =>
                    setSelectedTest(
                      "TEST1"
                    )
                  }
                >
                  <strong>
                    TEST 1
                  </strong>

                  <small>
                    {
                      test1Count
                    }{" "}
                    questions
                  </small>
                </button>

                <button
                  className={
                    selectedTest ===
                    "TEST2"
                      ? "test-option selected"
                      : "test-option"
                  }
                  onClick={() =>
                    setSelectedTest(
                      "TEST2"
                    )
                  }
                >
                  <strong>
                    TEST 2
                  </strong>

                  <small>
                    {
                      test2Count
                    }{" "}
                    questions
                  </small>
                </button>

                <button
                  className={
                    selectedTest ===
                    "BOTH"
                      ? "test-option selected"
                      : "test-option"
                  }
                  onClick={() =>
                    setSelectedTest(
                      "BOTH"
                    )
                  }
                >
                  <strong>
                    BOTH TESTS
                  </strong>

                  <small>
                    {
                      questionBank.length
                    }{" "}
                    questions
                  </small>
                </button>

              </div>

              {/* CLASSIFICATION STATUS */}

              <div className="selected-info">

                Currently analysing:{" "}

                <strong>
                  {selectedTest ===
                  "BOTH"
                    ? "TEST 1 + TEST 2"
                    : selectedTest}
                </strong>

                <br />

                <small>
                  TEST 1:{" "}
                  <b>
                    {
                      test1Count
                    }
                  </b>
                  {"  |  "}
                  TEST 2:{" "}
                  <b>
                    {
                      test2Count
                    }
                  </b>
                  {"  |  "}
                  Unclassified:{" "}
                  <b>
                    {
                      unknownCount
                    }
                  </b>
                </small>

              </div>

            </section>

            {/* =================================================
                PATTERN
            ================================================= */}

            <section className="card pattern-card">

              <div className="card-title">
                📐 Question Pattern
              </div>

              <p>
                Enter one section per
                line.
              </p>

              <textarea
                rows="5"
                value={
                  patternText
                }
                onChange={(e) =>
                  setPatternText(
                    e.target
                      .value
                  )
                }
                placeholder={
                  "5 × 2 = 10\n4 × 5 = 20\n2 × 10 = 20"
                }
              />

              <div className="total-box">

                <span>
                  Total Marks
                </span>

                <strong>
                  {
                    totalMarks
                  }
                </strong>

              </div>

              <button
                className="generate-button"
                onClick={
                  generateQuestionPaper
                }
              >
                ✨ Generate Question
                Paper
              </button>

            </section>

            {/* STATS */}

            <section className="stats">

              <div className="stat">

                <span>
                  Questions Analysed
                </span>

                <strong>
                  {
                    filteredQuestions.length
                  }
                </strong>

              </div>

              <div className="stat">

                <span>
                  High Priority
                </span>

                <strong>
                  {
                    importantQuestions.filter(
                      (q) =>
                        q.priority >=
                        65
                    ).length
                  }
                </strong>

              </div>

              <div className="stat">

                <span>
                  Topics Detected
                </span>

                <strong>
                  {
                    topicData.length
                  }
                </strong>

              </div>

              <div className="stat">

                <span>
                  Paper Marks
                </span>

                <strong>
                  {
                    totalMarks
                  }
                </strong>

              </div>

            </section>

            {/* TOPICS */}

            {topicData.length >
              0 && (
              <section className="card">

                <div className="section-heading">

                  <div>

                    <p className="eyebrow">
                      TOPIC ANALYSIS
                    </p>

                    <h2>
                      Detected Topics
                    </h2>

                  </div>

                </div>

                <div className="topic-grid">

                  {topicData.map(
                    ([
                      topic,
                      count,
                    ]) => (
                      <div
                        className="topic"
                        key={
                          topic
                        }
                      >

                        <span>
                          {
                            topic
                          }
                        </span>

                        <strong>
                          {
                            count
                          }
                        </strong>

                      </div>
                    )
                  )}

                </div>

              </section>
            )}

          </>
        )}

        {/* =================================================
            IMPORTANT QUESTIONS
        ================================================= */}

        {activePage ===
          "important" && (
          <section className="card">

            <div className="section-heading">

              <div>

                <p className="eyebrow">
                  {
                    selectedTest ===
                    "BOTH"
                      ? "TEST 1 + TEST 2"
                      : selectedTest
                  }
                </p>

                <h2>
                  Important Questions
                </h2>

              </div>

              <button
                className="secondary-button"
                onClick={
                  loadDemo
                }
              >
                Load Demo
              </button>

            </div>

            {importantQuestions.length ===
            0 ? (
              <div className="empty">
                Upload a question
                bank to analyse
                important questions.
              </div>
            ) : (
              <div className="question-list">

                {importantQuestions.map(
                  (
                    item,
                    index
                  ) => {

                    const priorityClass =
                      item.priority >=
                      75
                        ? "very-high"
                        : item.priority >=
                          55
                        ? "high"
                        : "medium";

                    const priorityLabel =
                      item.priority >=
                      75
                        ? "VERY HIGH"
                        : item.priority >=
                          55
                        ? "HIGH"
                        : "MEDIUM";

                    return (
                      <div
                        className="question-item"
                        key={
                          item.id
                        }
                      >

                        <div className="rank">
                          #
                          {
                            index +
                            1
                          }
                        </div>

                        <div className="question-content">

                          <div className="question-text">
                            {
                              item.question
                            }
                          </div>

                          <div className="question-meta">

                            <span>
                              {
                                item.topic
                              }
                            </span>

                            <span>
                              {
                                item.test
                              }
                            </span>

                            <span>
                              Repetition:{" "}
                              {
                                item.repetition
                              }
                            </span>

                          </div>

                        </div>

                        <div
                          className={`priority ${priorityClass}`}
                        >

                          {
                            priorityLabel
                          }

                          <small>
                            {
                              item.priority
                            }
                            %
                          </small>

                        </div>

                      </div>
                    );
                  }
                )}

              </div>
            )}

          </section>
        )}

        {/* =================================================
            QUESTION PAPER
        ================================================= */}

        {activePage ===
          "paper" && (
          <section className="paper-page">

            {!paper.length ? (

              <div className="empty-card">

                <div className="empty-icon">
                  📄
                </div>

                <h2>
                  Your question paper
                  is waiting
                </h2>

                <p>
                  Generate a paper
                  from the Dashboard.
                </p>

                <button
                  className="generate-button"
                  onClick={() =>
                    setActivePage(
                      "dashboard"
                    )
                  }
                >
                  Go to Dashboard
                </button>

              </div>

            ) : (

              <>

                {/* TOOLBAR */}

                <div className="paper-toolbar no-print">

                  <div>

                    <p className="eyebrow">
                      GENERATED PAPER
                    </p>

                    <h2>
                      {
                        subject
                      }
                    </h2>

                    <small>
                      Source:{" "}
                      {
                        selectedTest ===
                        "BOTH"
                          ? "TEST 1 + TEST 2"
                          : selectedTest
                      }
                    </small>

                  </div>

                  <div className="toolbar-actions">

                    <button
                      className="secondary-button"
                      onClick={
                        generateAnotherPaper
                      }
                    >
                      🔄 Another Set
                    </button>

                    <button
                      className="secondary-button"
                      onClick={
                        printPaper
                      }
                    >
                      🖨️ Print
                    </button>

                    <button
                      className="primary-button"
                      onClick={
                        downloadPDF
                      }
                    >
                      ⬇️ Download PDF
                    </button>

                  </div>

                </div>

                {/* PAPER */}

                <article className="question-paper">

                  <div className="paper-header">

                    <h2>
                      {
                        college
                      }
                    </h2>

                    <h3>
                      MODEL QUESTION PAPER
                    </h3>

                    <div className="paper-info">

                      <span>
                        Subject:{" "}
                        <b>
                          {
                            subject
                          }
                        </b>
                      </span>

                      <span>
                        Time:{" "}
                        <b>
                          {
                            examTime
                          }
                        </b>
                      </span>

                      <span>
                        Max Marks:{" "}
                        <b>
                          {
                            totalMarks
                          }
                        </b>
                      </span>

                    </div>

                  </div>

                  <div className="paper-body">

                    {paper.map(
                      (
                        section
                      ) => {

                        const previousCount =
                          paper
                            .slice(
                              0,
                              section.sectionNumber -
                                1
                            )
                            .reduce(
                              (
                                total,
                                current
                              ) =>
                                total +
                                current.count,
                              0
                            );

                        return (
                          <section
                            className="paper-section"
                            key={
                              section.sectionNumber
                            }
                          >

                            <h4>

                              <span>
                                SECTION{" "}
                                {
                                  section.sectionNumber
                                }
                              </span>

                              <span>
                                {
                                  section.count
                                }
                                {" × "}
                                {
                                  section.marks
                                }
                                {" = "}
                                {
                                  section.total
                                }
                              </span>

                            </h4>

                            <ol
                              start={
                                previousCount +
                                1
                              }
                            >

                              {section.questions.map(
                                (
                                  question,
                                  questionIndex
                                ) => (

                                  <li
                                    key={`${section.sectionNumber}-${questionIndex}-${question.id}`}
                                  >
                                    {
                                      question.question
                                    }
                                  </li>

                                )
                              )}

                            </ol>

                          </section>
                        );
                      }
                    )}

                  </div>

                  <div className="paper-footer">
                    — End of Question
                    Paper —
                  </div>

                </article>

              </>
            )}

          </section>
        )}

      </main>

      <footer>
        Exam Predict AI • Smart Question
        Analysis & Paper Generation
      </footer>

    </div>
  );
}

export default App;