document.getElementById('reservation-form').addEventListener('submit', function(event) {
  event.preventDefault(); // Prevent page reload

  const form = this;

  emailjs.sendForm('TKmI_QxR6Je9-MDea', 'template_vvf5z4h', form)
    .then(() => {
      alert('Reservation sent successfully!');
      form.reset(); // Clear the form
    }, (error) => {
      console.error('Failed to send reservation:', error);
      alert('Failed to send reservation. Try again.');
    });
});