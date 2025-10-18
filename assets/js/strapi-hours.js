async function loadOpeningHours() {
  try {
    const res = await fetch('http://127.0.0.1:1337/api/opening-hours1'); // change endpoint if needed
    const json = await res.json();
    const hours = json.data;

    // Map Strapi day names to JS days
    const dayMap = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };

    const todayIndex = new Date().getDay();
    const today = hours.find(h => dayMap[h.day] === todayIndex);

    const target = document.getElementById('open-hours');
    if (!target) return;

    if (!today || today.closed) {
      target.textContent = 'Closed today';
    } else {
      // Convert 24hr time to readable format
      const formatTime = t => {
        const [h, m] = t.split(':').map(Number);
        const ampm = h >= 12 ? 'pm' : 'am';
        const hour = h % 12 || 12;
        return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
      };

      target.textContent = `Open today: ${formatTime(today.open_time)} – ${formatTime(today.close_time)}`;
    }
  } catch (err) {
    console.error('Failed to load opening hours:', err);
    document.getElementById('open-hours').textContent = 'Hours unavailable';
  }
}

document.addEventListener('DOMContentLoaded', loadOpeningHours);