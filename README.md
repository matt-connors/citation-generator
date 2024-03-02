# Citation Generator

## Introduction
This is a simple citation generator website which produces citations in MLA, APA, and other formats, provided a url or other information about a source.

## Architecture
This project is hosted on Cloudflare Pages and uses Cloudflare Workers for api endpoints. The website is built using Astro, a static site generator, and React for interactive components.

## Working with the code

To preview just the static site using Astro, you can run the following command: \
`npm run dev`

In order to preview the entire project locally prior to deployment, as if it were on Cloudflare, you will need to install wrangler: \
`npm install wrangler --save-dev`

Then, you can preview the site using the following command: \
`npm run preview`

> Running the preview command will statically generate the site and use wrangler to start a local server. Note that making changes to the site will require you to stop the server and run the preview command again.

### Endpoints
- `/**` - Statically generated files using Astro.
- `/api/**` - Routes to the /functions directory for serverless functions via Cloudflare Functions.

## Authors
This project was created by Matt Connors and Brian Grier at Bridgewater State University.

## Live URL
Hosted on Cloudflare &mdash; [https://citation-generator-5bt.pages.dev/](https://citation-generator-5bt.pages.dev/)