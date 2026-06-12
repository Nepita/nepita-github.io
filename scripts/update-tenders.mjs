#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dashboardDir = path.resolve(__dirname, "..");
const dataPath = path.join(dashboardDir, "data.js");
const zipPath = path.resolve(dashboardDir, "..", "bau-ausschreibungen-dashboard-deploy.zip");
const desktopZipPath = path.resolve(process.env.HOME || ".", "Desktop", "bau-ausschreibungen-dashboard-deploy.zip");

const RSS_URL = "https://www.service.bund.de/Content/Globals/Functions/RSSFeed/RSSGenerator_Ausschreibungen.xml";

const KEYWORDS = [
  "abbruch",
  "asphalt",
  "aussenanlage",
  "außenanlage",
  "bau",
  "beton",
  "bruecke",
  "brücke",
  "dach",
  "erdarbeit",
  "erdbau",
  "erschliessung",
  "erschließung",
  "estrich",
  "fassade",
  "fenster",
  "hochbau",
  "ingenieurbau",
  "kanal",
  "kita",
  "leitung",
  "rohbau",
  "sanierung",
  "schule",
  "strasse",
  "straße",
  "tiefbau",
  "verkehrsinfrastruktur"
];

const STATES = [
  "Baden-Wuerttemberg",
  "Baden-Württemberg",
  "Bayern",
  "Berlin",
  "Brandenburg",
  "Bremen",
  "Hamburg",
  "Hessen",
  "Mecklenburg-Vorpommern",
  "Niedersachsen",
  "Nordrhein-Westfalen",
  "Rheinland-Pfalz",
  "Saarland",
  "Sachsen-Anhalt",
  "Sachsen",
  "Schleswig-Holstein",
  "Thueringen",
  "Thüringen"
];

function decodeEntities(value = "") {
  const named = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: "\"",
    Auml: "Ae",
    Ouml: "Oe",
    Uuml: "Ue",
    auml: "ae",
    ouml: "oe",
    uuml: "ue",
    szlig: "ss"
  };

  return value
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-zA-Z]+);/g, (match, name) => named[name] ?? match)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tagValue(xml, tag) {
  return decodeEntities(xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1] ?? "");
}

function descriptionField(description, label) {
  const pattern = new RegExp(`${label}:\\s*([\\s\\S]+?)(?=\\s(?:Vergabestelle|Angebotsfrist|Veroeffentlichungsende|Veröffentlichungsende):|$)`, "i");
  return description.match(pattern)?.[1]?.trim() ?? "";
}

function parseGermanDeadline(value) {
  const match = value.match(/(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (!match) return null;
  const [, day, month, year, hour = "12", minute = "00"] = match;
  return `${year}-${month}-${day}T${hour}:${minute}:00+02:00`;
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function inferCategory(text) {
  const lower = text.toLowerCase();
  if (/(bruecke|brücke|ingenieurbau|talbruecke|talbrücke|ueberfuehrung|überführung)/.test(lower)) return "Bruecken";
  if (/(tiefbau|kanal|leitung|strasse|straße|asphalt|erdarbeit|verkehrsinfrastruktur|aussenanlage|außenanlage)/.test(lower)) return "Tiefbau";
  return "Hochbau";
}

function inferPriority(deadline, category) {
  const left = daysLeft(deadline);
  if (left !== null && left <= 14) return "hoch";
  if (category === "Bruecken" || category === "Tiefbau") return "hoch";
  return "mittel";
}

function inferStatus(deadline) {
  const left = daysLeft(deadline);
  if (left !== null && left <= 7) return "Dringend";
  return "Neu";
}

function daysLeft(deadline) {
  if (!deadline) return null;
  return Math.ceil((new Date(deadline) - new Date()) / 86400000);
}

function inferState(location) {
  return STATES.find((state) => location.toLowerCase().includes(state.toLowerCase())) ?? "Bundesweit";
}

function isRelevant(item) {
  const haystack = [item.title, item.description].join(" ").toLowerCase();
  return KEYWORDS.some((keyword) => haystack.includes(keyword));
}

function isOpen(item) {
  if (!item.deadline) return false;
  return new Date(item.deadline).getTime() >= Date.now();
}

function parseItems(xml) {
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  return itemBlocks.map((block) => {
    const title = tagValue(block, "title");
    const url = tagValue(block, "link").replace(/#track=.*$/, "");
    const description = tagValue(block, "description")
      .replace(/Veröffentlichungsende/g, "Veroeffentlichungsende");
    const location = descriptionField(description, "Erfuellungsort") ||
      descriptionField(description, "Erfüllungsort") ||
      "Noch pruefen";
    const client = descriptionField(description, "Vergabestelle") || "Vergabestelle";
    const deadlineText = descriptionField(description, "Angebotsfrist");
    const deadline = parseGermanDeadline(deadlineText);
    const category = inferCategory(`${title} ${description}`);

    return {
      id: slugify(`${title}-${client}-${deadlineText}`),
      title,
      client,
      location,
      state: inferState(location),
      deadline,
      execution: "Noch pruefen",
      category,
      type: "Oeffentlich",
      priority: inferPriority(deadline, category),
      status: inferStatus(deadline),
      summary: description || "Aktuelle Ausschreibung von service.bund.de.",
      url,
      description
    };
  }).filter((item) => item.title && item.url && isRelevant(item) && isOpen(item));
}

function uniqueById(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function stripInternalFields(item) {
  const { description, ...publicItem } = item;
  return publicItem;
}

async function readCurrentData() {
  const content = await readFile(dataPath, "utf8");
  const jsonLike = content
    .replace(/^window\.TENDER_DATA\s*=\s*/, "")
    .replace(/;\s*$/, "");
  return Function(`"use strict"; return (${jsonLike});`)();
}

async function writeData(data) {
  const content = `window.TENDER_DATA = ${JSON.stringify(data, null, 2)};\n`;
  await writeFile(dataPath, content, "utf8");
}

async function refreshDeployZip() {
  await execFileAsync("ditto", ["-c", "-k", "--keepParent", dashboardDir, zipPath]);
  await execFileAsync("cp", [zipPath, desktopZipPath]);
}

async function triggerDeployHook() {
  const hook = process.env.NETLIFY_DEPLOY_HOOK;
  if (!hook) return false;
  await fetch(hook, { method: "POST" });
  return true;
}

async function main() {
  const current = await readCurrentData();
  const response = await fetch(RSS_URL);
  if (!response.ok) throw new Error(`RSS download failed: ${response.status} ${response.statusText}`);
  const xml = await response.text();
  const fetched = uniqueById(parseItems(xml))
    .sort((a, b) => {
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline) - new Date(b.deadline);
    })
    .slice(0, 60)
    .map(stripInternalFields);

  const privateNote = current.tenders.find((item) => item.id === "private-gewerbliche-bauvorhaben");
  const tenders = privateNote ? [...fetched, privateNote] : fetched;

  const nextData = {
    ...current,
    updatedAt: new Date().toISOString(),
    tenders
  };

  await writeData(nextData);
  await refreshDeployZip();
  const deployed = await triggerDeployHook();

  console.log(`Updated ${dataPath}`);
  console.log(`Tenders: ${fetched.length}${privateNote ? " + private/gewerblich note" : ""}`);
  console.log(`Deploy ZIP: ${zipPath}`);
  console.log(`Desktop ZIP: ${desktopZipPath}`);
  console.log(deployed ? "Netlify deploy hook triggered." : "No NETLIFY_DEPLOY_HOOK set; upload the ZIP or connect Git/Netlify for public updates.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
