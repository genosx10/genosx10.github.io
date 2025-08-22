function getError404Html() {
  return `
    <h1>Error 404</h1>
    <p>La página que buscas no existe o ha sido movida.</p>
    <p><a href="/football/laliga/matches/">Ver calendario de la Liga</a></p>
  `;
}

document.body.innerHTML = getError404Html();