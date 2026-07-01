#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

const INDEXNOW_KEY = '5118ad02fba44449a602ee1046d3bc60';
const HOST = 'mlagenerator.com';
const DEFAULT_ENDPOINT = 'https://api.indexnow.org/indexnow';
const DEFAULT_SITEMAP = 'dist/sitemap-0.xml';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const endpoint = optionValue('--endpoint=') ?? DEFAULT_ENDPOINT;
const sitemapSource = optionValue('--sitemap=') ?? DEFAULT_SITEMAP;

function optionValue(prefix) {
    return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

async function readText(source) {
    if (/^https?:\/\//i.test(source)) {
        const response = await fetch(source);
        if (!response.ok) {
            throw new Error(`Could not fetch ${source}: ${response.status} ${response.statusText}`);
        }
        return response.text();
    }

    return readFile(source, 'utf8');
}

function sitemapUrls(xml) {
    return Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g), (match) => match[1])
        .filter((url) => new URL(url).hostname === HOST);
}

const xml = await readText(sitemapSource);
const urlList = sitemapUrls(xml);

if (urlList.length === 0) {
    throw new Error(`No ${HOST} URLs found in ${sitemapSource}`);
}

const payload = {
    host: HOST,
    key: INDEXNOW_KEY,
    keyLocation: `https://${HOST}/${INDEXNOW_KEY}.txt`,
    urlList,
};

if (dryRun) {
    console.log(JSON.stringify({
        endpoint,
        count: payload.urlList.length,
        ...payload,
    }, null, 2));
    process.exit(0);
}

const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(payload),
});

if (!response.ok && response.status !== 202) {
    const body = await response.text();
    throw new Error(`IndexNow submission failed: ${response.status} ${response.statusText}\n${body}`);
}

console.log(`Submitted ${payload.urlList.length} URLs to IndexNow (${response.status}).`);
