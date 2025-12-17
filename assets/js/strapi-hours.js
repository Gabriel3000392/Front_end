async function loadOpeningHours() {
  try {
    const res = await fetch('https://admin.thesailandanchor.co.nz/api/opening-hours1');
    const json = await res.json();
    const hours = json.data;

    const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const todayIndex = new Date().getDay();
    const todaysHours = hours.filter(h => dayMap[h.day] === todayIndex);

    // Select all elements with ID 'open-hours'
    const targets = document.querySelectorAll('#open-hours');
    if (!targets.length) return;

    let text;
    if (!todaysHours.length || todaysHours.every(h => h.closed)) {
      text = 'Closed today';
    } else {
      const formatTime = t => {
        const [h, m] = t.split(':').map(Number);
        const ampm = h >= 12 ? 'pm' : 'am';
        const hour = h % 12 || 12;
        return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
      };

      text = `Open today: ${todaysHours
        .filter(h => !h.closed)
        .map(h => `${formatTime(h.open_time)} – ${formatTime(h.close_time)}`)
        .join(', ')}`;
    }

    // Update all instances
    targets.forEach(el => el.textContent = text);

  } catch (err) {
    console.error('Failed to load opening hours:', err);
    document.querySelectorAll('#open-hours').forEach(el => el.textContent = 'Hours unavailable');
  }
}

document.addEventListener('DOMContentLoaded', loadOpeningHours);
