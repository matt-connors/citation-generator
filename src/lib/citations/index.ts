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

/**
 * Fetch the citation data from the server.
 */
async function fetchCitationData() {
    const params = getUrlParams();
    console.log('fetching ...');
    const response = await fetch(`http://127.0.0.1:8788/api/test?url=${encodeURIComponent(params.website)}`, {
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