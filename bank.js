
const DEFAULT_DATA = {
  accounts: [
    { id: "card", name: "Kortkonto", balance: 1250 },
    { id: "savings", name: "Sparkonto", balance: 850 },
    { id: "atm", name: "Bankomatkonto", balance: 200 }
  ],
  transactions: [],
  goals: [],
  receipts: [],
  notices: [],
  atmHistory: []
};

function loadData() {
  try {
    return JSON.parse(localStorage.getItem("igelkotts_bank_demo"))
      || structuredClone(DEFAULT_DATA);
  } catch {
    return structuredClone(DEFAULT_DATA);
  }
}

function saveData(data) {
  localStorage.setItem("igelkotts_bank_demo", JSON.stringify(data));
}

function money(amount) {
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK"
  }).format(amount);
}

function safe(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  })[char]);
}

function dateText(date) {
  return new Date(date).toLocaleString("sv-SE");
}

function message(id, text) {
  const element = document.getElementById(id);
  if (element) element.textContent = text;
}

function addNotice(data, text) {
  data.notices.unshift({
    text,
    date: new Date().toISOString()
  });
}

function addTransaction(data, text, amount, accountId, type) {
  data.transactions.unshift({
    text, amount, accountId, type,
    date: new Date().toISOString()
  });
}

function render() {
  const data = loadData();

  const total = data.accounts.reduce(
    (sum, account) => sum + account.balance, 0
  );

  const totalElement = document.getElementById("total-balance");
  if (totalElement) totalElement.textContent = money(total);

  const accountElement = document.getElementById("accounts");
  if (accountElement) {
    accountElement.innerHTML = data.accounts.map(account => `
      <div class="account">
        <strong>${safe(account.name)}</strong>
        <p class="money">${money(account.balance)}</p>
      </div>
    `).join("");
  }

  const transactionElement = document.getElementById("transactions");
  if (transactionElement) {
    transactionElement.innerHTML = data.transactions.length
      ? data.transactions.slice(0, 10).map(item => `
        <div class="list-item">
          <strong>${safe(item.text)}</strong>
          <small>${safe(item.type)} · ${dateText(item.date)}</small>
          ${money(item.amount)}
        </div>
      `).join("")
      : "<p>Inga transaktioner ännu.</p>";
  }

  const goalElement = document.getElementById("goals-list");
  if (goalElement) {
    goalElement.innerHTML = data.goals.length
      ? data.goals.map((goal, index) => {
        const percent = Math.min(
          100, Math.round(goal.saved / goal.target * 100)
        );
        return `
          <div class="list-item">
            <strong>${safe(goal.name)}</strong>
            <p>${money(goal.saved)} av ${money(goal.target)}</p>
            <progress value="${percent}" max="100"></progress>
            <button class="secondary" data-delete-goal="${index}">
              Ta bort mål
            </button>
          </div>
        `;
      }).join("")
      : "<p>Du har inga sparmål ännu.</p>";
  }

  const receiptElement = document.getElementById("receipts-list");
  if (receiptElement) {
    receiptElement.innerHTML = data.receipts.length
      ? data.receipts.map(receipt => `
        <div class="list-item">
          <strong>${safe(receipt.store)}</strong>
          <small>${safe(receipt.items)} · ${dateText(receipt.date)}</small>
          ${money(receipt.total)}
        </div>
      `).join("")
      : "<p>Inga kvitton ännu.</p>";
  }

  const noticeElement = document.getElementById("notices-list");
  if (noticeElement) {
    noticeElement.innerHTML = data.notices.length
      ? data.notices.slice(0, 20).map(item => `
        <div class="list-item">
          ${safe(item.text)}
          <small>${dateText(item.date)}</small>
        </div>
      `).join("")
      : "<p>Inga notiser ännu.</p>";
  }

  const historyElement = document.getElementById("atm-history");
  if (historyElement) {
    historyElement.innerHTML = data.atmHistory.length
      ? data.atmHistory.map(item => `
        <div class="list-item">
          <strong>${safe(item.type)} · ${money(item.amount)}</strong>
          <small>Bankomat ${safe(item.code)} · ${dateText(item.date)}</small>
        </div>
      `).join("")
      : "<p>Ingen bankomathistorik ännu.</p>";
  }

  const atmBalance = document.getElementById("atm-balance");
  if (atmBalance) {
    const atm = data.accounts.find(account => account.id === "atm");
    atmBalance.textContent = money(atm.balance);
  }
}

function setupTransfers() {
  const form = document.getElementById("transfer-form");
  if (!form) return;

  const data = loadData();
  const normalAccounts = data.accounts.filter(a => a.id !== "atm");

  for (const field of ["source", "destination"]) {
    form.elements[field].innerHTML = normalAccounts.map(account => `
      <option value="${account.id}">${safe(account.name)}</option>
    `).join("");
  }

  form.elements.destination.selectedIndex = 1;

  form.addEventListener("submit", event => {
    event.preventDefault();

    const data = loadData();
    const from = data.accounts.find(
      account => account.id === form.elements.source.value
    );
    const to = data.accounts.find(
      account => account.id === form.elements.destination.value
    );
    const amount = Number(form.elements.amount.value);

    if (!from || !to || from.id === to.id || amount <= 0) {
      message("transfer-message", "Välj två olika konton och ett giltigt belopp.");
      return;
    }

    if (from.balance < amount) {
      message("transfer-message", "Du har inte tillräckligt med pengar.");
      return;
    }

    from.balance -= amount;
    to.balance += amount;

    addTransaction(data, `Överföring till ${to.name}`,
      -amount, from.id, "Egen överföring");
    addTransaction(data, `Överföring från ${from.name}`,
      amount, to.id, "Egen överföring");
    addNotice(data, `Du överförde ${money(amount)} till ${to.name}.`);

    saveData(data);
    render();
    message("transfer-message", "Överföringen är klar i testversionen.");
    form.elements.amount.value = "";
  });
}

function setupGoals() {
  const form = document.getElementById("goal-form");
  if (!form) return;

  form.addEventListener("submit", event => {
    event.preventDefault();

    const data = loadData();
    const name = form.elements.name.value.trim();
    const target = Number(form.elements.target.value);
    const source = form.elements.source.value;

    if (!name || target <= 0 || !source) {
      message("goal-message", "Fyll i alla fält.");
      return;
    }

    data.goals.push({ name, target, saved: 0, source });
    saveData(data);
    render();
    form.reset();
    message("goal-message", "Ditt sparmål har sparats.");
  });

  document.getElementById("goals-list").addEventListener("click", event => {
    const button = event.target.closest("[data-delete-goal]");
    if (!button) return;

    const data = loadData();
    data.goals.splice(Number(button.dataset.deleteGoal), 1);
    saveData(data);
    render();
  });
}

function setupReceipts() {
  const form = document.getElementById("receipt-form");
  if (!form) return;

  const select = form.elements.account;
  select.innerHTML = loadData().accounts
    .filter(account => account.id !== "atm")
    .map(account => `<option value="${account.id}">${safe(account.name)}</option>`)
    .join("");

  form.addEventListener("submit", event => {
    event.preventDefault();

    const data = loadData();
    const store = form.elements.store.value.trim();
    const items = form.elements.items.value.trim();
    const total = Number(form.elements.total.value);
    const account = data.accounts.find(
      item => item.id === form.elements.account.value
    );

    if (!store || !items || !account || total <= 0) {
      message("receipt-message", "Kontrollera uppgifterna.");
      return;
    }

    if (account.balance < total) {
      message("receipt-message", "Kontot har inte tillräckligt saldo.");
      return;
    }

    account.balance -= total;
    data.receipts.unshift({
      store, items, total, date: new Date().toISOString()
    });

    addTransaction(data, `Köp hos ${store}`, -total, account.id, "Köp");
    addNotice(data, `Kvitto från ${store} har sparats.`);

    saveData(data);
    render();
    form.reset();
    message("receipt-message", "Köpet registrerades och kvittot sparades.");
  });
}

function setupATM() {
  const form = document.getElementById("atm-form");
  if (!form) return;

  form.addEventListener("submit", event => {
    event.preventDefault();

    const data = loadData();
    const type = form.elements.kind.value;
    const amount = Number(form.elements.amount.value);
    const code = form.elements.atmcode.value.trim();
    const atm = data.accounts.find(account => account.id === "atm");

    if (!code || amount <= 0) {
      message("atm-message", "Ange bankomatkod och ett giltigt belopp.");
      return;
    }

    if (type === "uttag" && atm.balance < amount) {
      message("atm-message", "Bankomatkontot har inte tillräckligt saldo.");
      return;
    }

    atm.balance += type === "insättning" ? amount : -amount;

    data.atmHistory.unshift({
      type, amount, code, date: new Date().toISOString()
    });

    addTransaction(data, `Bankomat: ${type}`,
      type === "insättning" ? amount : -amount, atm.id, "Bankomat");
    addNotice(data, `Bankomat ${type}: ${money(amount)}.`);

    saveData(data);
    render();
    form.reset();
    message("atm-message", "Transaktionen registrerades i testversionen.");
  });
}

function setupStaff() {
  const form = document.getElementById("staff-login");
  if (!form) return;

  form.addEventListener("submit", event => {
    event.preventDefault();

    if (form.elements.code.value === "123456") {
      document.getElementById("staff-tools").hidden = false;
      message("staff-message", "Testinloggningen lyckades.");
    } else {
      message("staff-message", "Fel testkod. Testkoden är 123456.");
    }
  });

  const reset = document.getElementById("reset-demo");
  if (reset) {
    reset.addEventListener("click", () => {
      localStorage.removeItem("igelkotts_bank_demo");
      location.reload();
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (!localStorage.getItem("igelkotts_bank_demo")) {
    saveData(structuredClone(DEFAULT_DATA));
  }

  render();
  setupTransfers();
  setupGoals();
  setupReceipts();
  setupATM();
  setupStaff();
});
