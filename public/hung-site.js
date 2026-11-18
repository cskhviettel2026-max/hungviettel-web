(() => {
  "use strict";
  const byId = id => document.getElementById(id);
  const config = JSON.parse(byId("hung-site-data").textContent);
  const node = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text) element.textContent = text;
    if (className) element.className = className;
    return element;
  };
  const money = value => value === null ? "Liên hệ báo giá" : new Intl.NumberFormat("vi-VN").format(value) + " ₫";
  const form = byId("form");
  const choices = [...form.querySelectorAll("input[name=products]")];
  const quotes = new Map();
  const dialog = byId("productModal");

  function showQuotes() {
    const box = byId("quoteChoices");
    box.replaceChildren();
    for (const [service, plan] of quotes) {
      const row = node("div", plan.name + " · " + money(plan.price), "hung-quote");
      const remove = node("button", "Bỏ gói");
      remove.type = "button";
      remove.addEventListener("click", () => { quotes.delete(service); requestId = crypto.randomUUID(); showQuotes(); });
      row.append(remove);
      box.append(row);
    }
  }

  function pick(service, plan, scroll = true) {
    const input = choices.find(choice => choice.value === service);
    if (!input) return;
    input.checked = true;
    if (plan) quotes.set(service, plan);
    if (scroll) requestId = crypto.randomUUID();
    showQuotes();
    if (scroll) {
      dialog.close();
      byId("register").scrollIntoView({ behavior: "smooth" });
    }
  }

  for (const input of choices) input.addEventListener("change", () => {
    if (!input.checked) { quotes.delete(input.value); showQuotes(); }
  });

  for (const link of document.querySelectorAll("[data-consult-product]")) {
    link.addEventListener("click", () => pick(link.dataset.consultProduct, undefined, false));
  }

  const slides = [...document.querySelectorAll("#slides .slide")];
  if (slides.length > 1) {
    let index = 0;
    let paused = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pause = byId("pause");
    const updatePause = () => {
      pause.textContent = paused ? "▶" : "Ⅱ";
      pause.setAttribute("aria-label", paused ? "Tiếp tục chuyển ảnh" : "Tạm dừng chuyển ảnh");
    };
    function move(delta) {
      index = (index + delta + slides.length) % slides.length;
      slides.forEach((slide, i) => {
        slide.classList.toggle("active", i === index);
        slide.setAttribute("aria-hidden", String(i !== index));
      });
      byId("slideCount").textContent = (index + 1) + " / " + slides.length;
    }
    byId("prev").onclick = () => move(-1);
    byId("next").onclick = () => move(1);
    pause.onclick = () => { paused = !paused; updatePause(); };
    updatePause();
    setInterval(() => { if (!paused && !document.hidden) move(1); }, 6500);
  }

  function showPlans(service) {
    byId("modalKicker").textContent = service.category;
    byId("modalTitle").textContent = "Bảng giá " + service.name;
    byId("modalDesc").textContent = service.description;
    byId("modalFeatures").replaceChildren(...service.points.filter(Boolean).map(text => node("li", text)));
    byId("officialLink").href = service.path;
    byId("chooseProduct").onclick = () => pick(service.id);
    const controls = node("div", "", "plan-filters");
    const search = node("input");
    search.type = "search";
    search.placeholder = "Tìm gói dịch vụ";
    search.setAttribute("aria-label", search.placeholder);
    const category = node("select");
    category.setAttribute("aria-label", "Nhóm báo giá");
    category.add(new Option("Tất cả nhóm", ""));
    for (const [group, label] of Object.entries(service.groups)) category.add(new Option(label, group));
    controls.append(search);
    if (Object.keys(service.groups).length) controls.append(category);
    const count = node("div", "", "plan-count");
    const grid = node("div", "", "plan-grid");
    const entries = service.plans.map(plan => {
      const card = node("article", "", "plan-card");
      const price = node("div", money(plan.price), "plan-price");
      if (plan.vatNote) price.append(node("small", plan.vatNote));
      const details = node("p");
      plan.details.forEach((text, i) => { if (i) details.append(node("br")); details.append(text); });
      const choose = node("button", "Chọn gói", "btn outline hung-choose");
      choose.type = "button";
      choose.addEventListener("click", () => pick(service.id, plan));
      card.append(node("h3", plan.name), price, details, choose);
      grid.append(card);
      return [plan, card];
    });
    function filter() {
      let total = 0;
      const keyword = search.value.toLocaleLowerCase("vi").trim();
      for (const [plan, card] of entries) {
        const group = category.value;
        card.hidden = !(!group || plan.group === group) ||
          !card.textContent.toLocaleLowerCase("vi").includes(keyword);
        if (!card.hidden) total += 1;
      }
      count.textContent = total ? total + " gói dịch vụ" : "Không tìm thấy gói phù hợp";
    }
    search.addEventListener("input", filter);
    category.addEventListener("change", filter);
    byId("productPricing").replaceChildren(controls, count, grid);
    filter();
    dialog.showModal();
    dialog.scrollTop = 0;
  }
  for (const button of document.querySelectorAll("[data-detail]")) {
    const service = config.catalog.find(item => item.id === button.dataset.detail);
    if (service) button.addEventListener("click", () => showPlans(service));
  }
  byId("closeProduct").onclick = () => dialog.close();

  const list = byId("videoList");
  if (list) {
    const consult = byId("videoConsult");
    function showVideo(video, index) {
      const media = node(video.kind === "mp4" ? "video" : "iframe");
      media.src = video.embed;
      if (video.kind === "mp4") {
        media.controls = true;
        media.preload = "none";
        if (video.poster) media.poster = video.poster;
      } else {
        media.title = "Video " + video.title;
        media.allowFullscreen = true;
        media.setAttribute("allow", "encrypted-media; picture-in-picture");
      }
      byId("videoMount").replaceChildren(media);
      byId("videoKicker").textContent = video.category ? "KHÁM PHÁ / " + video.category : "KHÁM PHÁ";
      byId("videoTitle").textContent = video.title;
      byId("videoLink").href = video.url;
      byId("videoNote").textContent = video.kind === "mp4"
        ? "Video hướng dẫn phiên bản desktop; giao diện có thể khác phiên bản đang sử dụng."
        : "Nếu trình phát không tải được, hãy chọn Mở video gốc.";
      consult.hidden = !video.service;
      consult.onclick = () => pick(video.service);
      [...list.children].forEach((item, i) => item.classList.toggle("active", i === index));
    }
    config.videos.forEach((video, i) => {
      const button = node("button", video.title, "videochoice");
      if (video.category) button.append(node("small", video.category));
      button.onclick = () => showVideo(video, i);
      list.append(button);
    });
    showVideo(config.videos[0], 0);
  }

  const search = new URLSearchParams(location.search);
  const service = config.catalog.find(item => item.id === search.get("san-pham"));
  if (service) pick(service.id, service.plans.find(plan => plan.id === search.get("goi")), false);

  let requestId = crypto.randomUUID();
  const status = byId("status");
  const submit = byId("submit");
  const submitText = submit.textContent;
  const done = byId("done");
  byId("close").onclick = () => done.close();
  // Changing the request after a failed attempt creates a new idempotency key.
  form.addEventListener("input", () => { requestId = crypto.randomUUID(); });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (submit.disabled) return;
    if (!config.catalog.length) {
      status.textContent = "Vui lòng gọi hotline để được tư vấn.";
      return;
    }
    const fields = new FormData(form);
    const products = fields.getAll("products");
    if (!products.length) { status.textContent = "Vui lòng chọn ít nhất một giải pháp."; return; }
    const data = {
      requestId, name: fields.get("name"), phone: fields.get("phone"), email: fields.get("email"),
      company: fields.get("company"), products, consent: fields.has("consent"), website: fields.get("website"),
      quotes: [...quotes].map(([serviceId, plan]) => ({serviceId, planId:plan.id}))
    };
    submit.disabled = true;
    submit.textContent = "Đang ghi nhận…";
    status.textContent = "";
    try {
      const response = await fetch("/api/consult", {
        method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(data), signal:AbortSignal.timeout(20_000)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Chưa thể ghi nhận. Vui lòng thử lại.");
      byId("summary").textContent = [
        "Mã đăng ký: " + result.id, "Họ tên: " + data.name,
        "Email: " + data.email, "Giải pháp: " + result.products.join(", ")
      ].join("\n");
      byId("emailStatus").textContent = "Thông tin đã được lưu. Hệ thống sẽ gửi email xác nhận. Nếu chưa nhận được, bạn có thể kiểm tra Spam hoặc liên hệ hotline.";
      done.showModal();
      form.reset();
      quotes.clear();
      showQuotes();
      requestId = crypto.randomUUID();
      status.textContent = "Đã ghi nhận đăng ký.";
    } catch (error) {
      status.textContent = error.name === "TimeoutError" ? "Kết nối quá lâu. Bạn có thể gửi lại cùng mã đăng ký." : error.message;
    } finally {
      submit.disabled = false;
      submit.textContent = submitText;
    }
  });
})();
