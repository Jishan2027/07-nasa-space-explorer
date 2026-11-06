const startInput = document.getElementById('startDate');
const endInput = document.getElementById('endDate');
setupDateInputs(startInput, endInput);


const fetchBtn = document.querySelector('.filters button');
const gallery = document.getElementById('gallery');
const modal = document.getElementById('modal');
const closeModalButton = document.getElementById('closeModal');
const modalMedia = document.getElementById('modalMedia');
const modalTitle = document.getElementById('modalTitle');
const modalDate = document.getElementById('modalDate');
const modalExplanation = document.getElementById('modalExplanation');

const apiUrl = 'https://science.nasa.gov/wp-json/wp/v2/apod-basic';
const apiKey = 'BpGC9D8JNwCgKNz9hBzrkT87MgDGGdP7qq9ktRGH';
const postsPerPage = 100;


function formatDate(dateString) {
  const dateParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString || '');

  if (!dateParts) {
    return '';
  }

  const [, year, month, day] = dateParts;
  const date = new Date(Number(year), Number(month) - 1, Number(day));

  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: '2-digit',
    year: 'numeric'
  });
}


function isUsableImageUrl(candidate) {
  if (typeof candidate !== 'string') {
    return false;
  }

  try {
    const imageUrl = new URL(candidate);
    const isImageFile = /\.(avif|gif|jpe?g|png|webp)$/i.test(imageUrl.pathname);
    const isFallbackImage =
      /(nasa[-_]?logo|placeholder|default[-_]?image|no[-_]?image)/i.test(
        imageUrl.pathname
      );

    return (
      (imageUrl.protocol === 'https:' || imageUrl.protocol === 'http:') &&
      isImageFile &&
      !isFallbackImage
    );
  } catch {
    return false;
  }
}

// NASA's high-resolution original is linked around the image in basic_html.
function getOriginalImageUrl(item) {
  if (typeof item.basic_html !== 'string') {
    return '';
  }

  const htmlDocument = new DOMParser().parseFromString(
    item.basic_html,
    'text/html'
  );
  const imageLink = Array.from(htmlDocument.querySelectorAll('a[href]')).find(
    link => link.querySelector('img') && isUsableImageUrl(link.href)
  );

  return imageLink ? imageLink.href : '';
}

// Prefer the original image for the modal and NASA's optimized image for cards.
function getImageUrl(item, highResolution = false) {
  const originalImageUrl = getOriginalImageUrl(item);
  const candidates = highResolution
    ? [originalImageUrl, item.hdurl, item.url]
    : [item.hdurl, originalImageUrl, item.url];

  return candidates.find(isUsableImageUrl) || '';
}

// Fetch every page needed to cover the selected date range.
async function fetchSpacePhotos() {
  const startDate = startInput.value;
  const endDate = endInput.value;

  if (!startDate || !endDate) {
    alert('Please select both a start and end date.');
    return;
  }

  if (startDate > endDate) {
    alert('Start date must be before end date.');
    return;
  }

  gallery.innerHTML = '<div class="loading">Loading space photos...</div>';

  try {
    const matchingItems = [];
    let page = 1;
    let totalPages = null;
    let reachedStartDate = false;

    while (!reachedStartDate && (totalPages === null || page <= totalPages)) {
      const requestUrl = new URL(apiUrl);
      requestUrl.searchParams.set('api_key', apiKey);
      requestUrl.searchParams.set('per_page', postsPerPage);
      requestUrl.searchParams.set('page', page);

      const response = await fetch(requestUrl);

      if (!response.ok) {
        throw new Error(`NASA API returned HTTP ${response.status}.`);
      }

      const items = await response.json();

      if (!Array.isArray(items)) {
        throw new Error('NASA API returned an unexpected response.');
      }

      const reportedPages = Number(response.headers.get('X-WP-TotalPages'));
      if (totalPages === null && Number.isInteger(reportedPages) && reportedPages > 0) {
        totalPages = reportedPages;
      }

      items.forEach(item => {
        if (
          item &&
          typeof item.date === 'string' &&
          item.date >= startDate &&
          item.date <= endDate
        ) {
          matchingItems.push(item);
        }
      });

    
      const oldestItem = items[items.length - 1];
      reachedStartDate = Boolean(oldestItem && oldestItem.date < startDate);

     
      if (totalPages === null && items.length < postsPerPage) {
        break;
      }

      page++;
    }

    matchingItems.sort((a, b) => a.date.localeCompare(b.date));
    renderGallery(matchingItems);
  } catch (error) {
    console.error('Could not fetch NASA space photos:', error);
    gallery.innerHTML = `
      <p class="placeholder">
        Could not fetch images from NASA. Please try again.
      </p>
    `;
  }
}

// Show image cards that have a date and a usable image URL.
function renderGallery(items) {
  gallery.innerHTML = '';

  const validItems = items
    .map(item => ({ item, imageUrl: getImageUrl(item) }))
    .filter(({ item, imageUrl }) =>
      item.media_type === 'image' &&
      formatDate(item.date) &&
      imageUrl
    );

  if (validItems.length === 0) {
    gallery.innerHTML = `
      <p class="placeholder">No space images found for these dates.</p>
    `;
    return;
  }

  validItems.forEach(({ item, imageUrl }) => {
    const card = document.createElement('div');
    card.classList.add('gallery-item');

    const image = document.createElement('img');
    image.src = imageUrl;
    image.alt = item.alt || item.title || 'NASA Space Image';
    image.loading = 'lazy';

    const cardInfo = document.createElement('div');
    cardInfo.classList.add('card-info');

    const title = document.createElement('h3');
    title.textContent = item.title || 'Space Explorer Photo';

    const date = document.createElement('p');
    date.classList.add('card-date');
    date.textContent = formatDate(item.date);

    cardInfo.append(title, date);
    card.append(image, cardInfo);
    card.addEventListener('click', () => openModal(item));
    gallery.appendChild(card);
  });
}


function openModal(item) {
  const image = document.createElement('img');
  image.src = getImageUrl(item, true);
  image.alt = item.alt || item.title || 'NASA Space Image';

  modalMedia.replaceChildren(image);
  modalTitle.textContent = item.title || 'NASA Space Photo';
  modalDate.textContent = formatDate(item.date);

  const explanationHtml = item.explanation || item.description || '';
  const explanationDocument = new DOMParser().parseFromString(
    explanationHtml,
    'text/html'
  );
  modalExplanation.textContent =
    explanationDocument.body.textContent.trim() || 'No description available.';

  modal.classList.remove('hidden');
}

function closeModal() {
  modal.classList.add('hidden');
  modalMedia.replaceChildren();
}

if (closeModalButton) {
  closeModalButton.addEventListener('click', closeModal);
}

if (modal) {
  modal.addEventListener('click', event => {
    if (event.target === modal) {
      closeModal();
    }
  });
}

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
    closeModal();
  }
});

if (fetchBtn) {
  fetchBtn.addEventListener('click', fetchSpacePhotos);
}
