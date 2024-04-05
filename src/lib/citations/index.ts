import { WebsiteCitation } from './citation';

const citation = new WebsiteCitation({
    authors: ["Smith, John"],
    sourceTitle: "The Impact of Climate Change on Coastal Communities",
    publisher: "Environmental News Network",
    publicationDate: { year: 2021, month: 3, day: 15 },
    accessDate: { year: 2021, month: 3, day: 16 },
    url: "www.enn.com/climate-change-impact-coastal-communities"
});

console.log(citation, citation.toMlaFormat());

const formattedCitation = citation.toMlaFormat();
const citationDiv = document.createElement('pre');
formattedCitation.forEach((text) => {
    const span = document.createElement('span');
    span.innerText = text.text;
    span.style.font = '400 16px/2 Times New Roman, Times, serif';
    span.style.letterSpacing = 'auto';
    if (text.italic) {
        span.style.fontStyle = 'italic';
    }
    const len = citationDiv.textContent!.length;
    if (len + text.text.length > 87) {
        let pre = text.text.slice(0, 87 - len);
        let post = text.text.slice(87 - len);
        // citationDiv.appendChild(document.createElement('br'));
        span.innerText = `${pre}\n\t${post}`;
    }
    citationDiv.appendChild(span);
});


document.body.appendChild(citationDiv);

/**
 * Retrieves the URL parameters from the current page as an object.
 */
function getUrlParams() {
    const url = window.location.search;
    const urlParams = new URLSearchParams(url);
    const params = {};
    for (const [key, value] of urlParams.entries()) {
        params[key] = value;
    }
    return params;
}

let { host, protocol } = window.location;

// change the host to the local server running backend if the host is localhost:3000
if (host === 'localhost:4321') {
    host = 'localhost:8788';
}

/**
 * Fetch the citation data from the server.
 */
async function fetchCitationData() {
    const params = getUrlParams();
    const response = await fetch(`${protocol}//${host}/api/test?url=${encodeURIComponent(params.website)}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    });
    
    return response.json();
}

/**
 * Renders the citation data to the page.
 */
async function renderCitationData() {
    const citationData = await fetchCitationData();
    const citationDiv = document.createElement('div');
    citationDiv.innerHTML = JSON.stringify(citationData);
    document.body.appendChild(citationDiv);
}

renderCitationData();