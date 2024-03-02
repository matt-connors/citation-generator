# Citation Generator

## Introduction
This is a simple citation generator website which produces citations in MLA, APA, and other formats, provided a url or other information about a source.

## Architecture
This project is hosted on Cloudflare Pages and uses Cloudflare Workers for api endpoints. The website is built using Astro, a static site generator, and React for interactive components.

### Endpoints
- `/**` - Statically generated files using Astro.
- `/api/**` - Routes to the /functions directory for serverless functions via Cloudflare Functions.

## Authors
This project was created by Matt Connors and Brian Grier at Bridgewater State University.

## Live URL
Hosted on Cloudflare &mdash; [https://citation-generator-5bt.pages.dev/](https://citation-generator-5bt.pages.dev/)