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