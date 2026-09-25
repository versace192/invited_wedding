(() => {
  const weddingDate = new Date('2026-09-26T17:00:00+05:00');

  const locations = {
    celebration: {
      address: 'г. Копейск, ул. Ручейная, 52',
    },
  };

  const encodeMapAddress = (address) => encodeURIComponent(address);
  const mapEmbedUrl = (address) =>
    `https://www.google.com/maps?q=${encodeMapAddress(address)}&output=embed`;

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function initCountdown() {
    const elements = {
      days: document.querySelector('[data-countdown="days"]'),
      hours: document.querySelector('[data-countdown="hours"]'),
      minutes: document.querySelector('[data-countdown="minutes"]'),
      seconds: document.querySelector('[data-countdown="seconds"]'),
    };
    const note = document.getElementById('countdownNote');

    if (!elements.days || !elements.hours || !elements.minutes || !elements.seconds) {
      return;
    }

    const update = () => {
      const diff = weddingDate.getTime() - Date.now();

      if (diff <= 0) {
        elements.days.textContent = '00';
        elements.hours.textContent = '00';
        elements.minutes.textContent = '00';
        elements.seconds.textContent = '00';
        if (note) {
          note.textContent = 'Наш свадебный день наступил';
        }
        return;
      }

      const days = Math.floor(diff / 86_400_000);
      const hours = Math.floor((diff % 86_400_000) / 3_600_000);
      const minutes = Math.floor((diff % 3_600_000) / 60_000);
      const seconds = Math.floor((diff % 60_000) / 1_000);

      elements.days.textContent = pad(days);
      elements.hours.textContent = pad(hours);
      elements.minutes.textContent = pad(minutes);
      elements.seconds.textContent = pad(seconds);
    };

    update();
    window.setInterval(update, 1000);
  }

  function initReveal() {
    const revealElements = [...document.querySelectorAll('.reveal')];

    if (!('IntersectionObserver' in window)) {
      revealElements.forEach((element) => element.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.14,
        rootMargin: '0px 0px -8% 0px',
      },
    );

    revealElements.forEach((element) => observer.observe(element));
  }

  function initRsvpNavigation() {
    const links = [...document.querySelectorAll('a[href="#rsvp"]')];
    const section = document.getElementById('rsvp');
    const form = document.getElementById('guestForm');

    if (!section) {
      return;
    }

    links.forEach((link) => {
      link.addEventListener('click', () => {
        // Make the form visible immediately when the user comes to it
        // through the header/hero buttons instead of relying only on
        // IntersectionObserver during programmatic anchor scrolling.
        section.querySelectorAll('.reveal').forEach((element) => {
          element.classList.add('is-visible');
        });

        window.setTimeout(() => {
          form?.querySelector('input[name="fullName"]')?.focus({ preventScroll: true });
        }, 350);
      });
    });
  }

  function initHeader() {
    const header = document.querySelector('.site-header');
    if (!header) {
      return;
    }

    const update = () => {
      header.classList.toggle('scrolled', window.scrollY > 24);
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
  }

  function initMap() {
    const frame = document.getElementById('mapFrame');
    const address = document.getElementById('mapAddress');
    const tabs = [...document.querySelectorAll('[data-map]')];

    if (!frame || !address || tabs.length === 0) {
      return;
    }

    const setMap = (key) => {
      const location = locations[key] || locations.celebration;

      frame.src = mapEmbedUrl(location.address);
      address.textContent = location.address;

      tabs.forEach((tab) => {
        const active = tab.dataset.map === key;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-selected', String(active));
      });
    };

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => setMap(tab.dataset.map));
    });

    setMap('celebration');
  }

  function getGoogleFormConfig() {
    const config = window.WEDDING_FORM_CONFIG || {};
    const fields = config.fields || {};
    const required = ['fullName', 'attendance', 'companion', 'preferences'];
    const ready =
      typeof config.googleFormAction === 'string' &&
      config.googleFormAction.trim().length > 0 &&
      required.every((key) => typeof fields[key] === 'string' && fields[key].trim().length > 0);

    return {
      action: config.googleFormAction,
      fields,
      ready,
    };
  }

  function setStatus(element, message, type) {
    element.textContent = message;
    element.classList.remove('error', 'success');

    if (type) {
      element.classList.add(type);
    }
  }

  function collectFormData(form) {
    const formData = new FormData(form);
    const preferences = formData.getAll('preferences');

    return {
      fullName: String(formData.get('fullName') || '').trim(),
      attendance: String(formData.get('attendance') || '').trim(),
      companion: String(formData.get('companion') || '').trim(),
      preferences,
      createdAt: new Date().toISOString(),
    };
  }

  function saveLocalResponse(data) {
    const key = 'wedding-rsvp-responses';
    const current = JSON.parse(window.localStorage.getItem(key) || '[]');
    current.push(data);
    window.localStorage.setItem(key, JSON.stringify(current));
  }

  function submitToGoogleForm(config, data) {
    return new Promise((resolve) => {
      const iframeName = `google-form-target-${Date.now()}`;
      const iframe = document.createElement('iframe');
      iframe.name = iframeName;
      iframe.hidden = true;

      const googleForm = document.createElement('form');
      googleForm.action = config.action;
      googleForm.method = 'POST';
      googleForm.target = iframeName;
      googleForm.hidden = true;

      const appendField = (name, value) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        googleForm.appendChild(input);
      };

      appendField(config.fields.fullName, data.fullName);
      appendField(config.fields.attendance, data.attendance);
      appendField(config.fields.companion, data.companion);

      // Google Forms checkbox questions expect one entry with the same
      // name for every selected option, rather than a comma-separated string.
      data.preferences.forEach((preference) => {
        appendField(config.fields.preferences, preference);
      });

      document.body.append(iframe, googleForm);
      googleForm.submit();

      // Keep the hidden target alive long enough for Google Forms to finish
      // processing the cross-origin POST, especially on mobile connections.
      window.setTimeout(() => {
        googleForm.remove();
        iframe.remove();
        resolve();
      }, 5000);
    });
  }

  function initPreferenceLogic(form) {
    const preferenceInputs = [...form.querySelectorAll('input[name="preferences"]')];
    const exclusive = preferenceInputs.find((input) => input.dataset.exclusive !== undefined);

    if (!exclusive) {
      return;
    }

    preferenceInputs.forEach((input) => {
      input.addEventListener('change', () => {
        if (input === exclusive && input.checked) {
          preferenceInputs.forEach((item) => {
            if (item !== exclusive) {
              item.checked = false;
            }
          });
          return;
        }

        if (input !== exclusive && input.checked) {
          exclusive.checked = false;
        }
      });
    });
  }

  function initForm() {
    const form = document.getElementById('guestForm');
    const status = document.getElementById('formStatus');

    if (!form || !status) {
      return;
    }

    initPreferenceLogic(form);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const submitButton = form.querySelector('button[type="submit"]');
      const data = collectFormData(form);

      if (!data.fullName) {
        setStatus(status, 'Пожалуйста, укажите фамилию, имя и отчество.', 'error');
        form.elements.fullName.focus();
        return;
      }

      if (!data.attendance) {
        setStatus(status, 'Пожалуйста, выберите вариант присутствия.', 'error');
        return;
      }

      submitButton.disabled = true;
      setStatus(status, 'Отправляем ответ...', '');

      try {
        const googleConfig = getGoogleFormConfig();
        saveLocalResponse(data);

        if (googleConfig.ready) {
          await submitToGoogleForm(googleConfig, data);
          setStatus(status, 'Спасибо! Анкета отправлена.', 'success');
        } else {
          setStatus(status, 'Спасибо! Ответ сохранен в этом браузере.', 'success');
        }

        form.reset();
      } catch (error) {
        setStatus(status, 'Не удалось отправить анкету. Попробуйте еще раз.', 'error');
      } finally {
        submitButton.disabled = false;
      }
    });
  }

  function drawPetal(ctx, x, y, size, rotation, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.bezierCurveTo(size * 0.62, -size * 0.56, size * 0.58, size * 0.48, 0, size);
    ctx.bezierCurveTo(-size * 0.58, size * 0.48, -size * 0.62, -size * 0.56, 0, -size);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  function initAmbientCanvas() {
    const canvas = document.getElementById('ambientCanvas');
    const ctx = canvas?.getContext('2d');

    if (!canvas || !ctx) {
      return;
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const colors = [
      'rgba(233, 186, 184, 0.34)',
      'rgba(167, 189, 169, 0.32)',
      'rgba(170, 196, 208, 0.3)',
      'rgba(201, 191, 215, 0.22)',
      'rgba(197, 154, 127, 0.2)',
    ];
    const petals = Array.from({ length: 34 }, (_, index) => ({
      x: ((index * 97) % 1000) / 1000,
      y: ((index * 181) % 1000) / 1000,
      size: 9 + ((index * 29) % 16),
      drift: 0.12 + ((index * 17) % 24) / 100,
      phase: index * 0.74,
      color: colors[index % colors.length],
    }));

    let width = 0;
    let height = 0;
    let ratio = 1;
    let lastFrame = 0;

    const resize = () => {
      ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const drawSilkBand = (offset, color, time, heightFactor) => {
      const y = height * heightFactor + Math.sin(time + offset) * 18;

      ctx.beginPath();
      ctx.moveTo(-80, y);
      ctx.bezierCurveTo(
        width * 0.22,
        y - 70 + Math.cos(time + offset) * 16,
        width * 0.44,
        y + 92,
        width * 0.7,
        y + Math.sin(time * 0.7 + offset) * 42,
      );
      ctx.bezierCurveTo(width * 0.9, y - 28, width + 70, y + 48, width + 90, y + 24);
      ctx.lineTo(width + 90, y + 126);
      ctx.bezierCurveTo(width * 0.74, y + 96, width * 0.42, y + 154, -80, y + 74);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    };

    const draw = (timestamp = 0) => {
      if (timestamp - lastFrame < 32 && !reduceMotion) {
        window.requestAnimationFrame(draw);
        return;
      }

      lastFrame = timestamp;
      const time = timestamp / 5200;

      const background = ctx.createLinearGradient(0, 0, width, height);
      background.addColorStop(0, '#f8eee8');
      background.addColorStop(0.33, '#fffdf9');
      background.addColorStop(0.68, '#edf4f0');
      background.addColorStop(1, '#f2edf4');
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);

      drawSilkBand(0.4, 'rgba(233, 186, 184, 0.22)', time, 0.18);
      drawSilkBand(2.1, 'rgba(170, 196, 208, 0.18)', time, 0.48);
      drawSilkBand(3.8, 'rgba(167, 189, 169, 0.18)', time, 0.76);

      petals.forEach((petal, index) => {
        const floatY = reduceMotion ? 0 : Math.sin(time * petal.drift + petal.phase) * 18;
        const floatX = reduceMotion ? 0 : Math.cos(time * 0.8 + petal.phase) * 24;
        const x = petal.x * width + floatX;
        const y = petal.y * height + floatY;
        const rotation = petal.phase + time * (index % 2 === 0 ? 0.28 : -0.24);
        drawPetal(ctx, x, y, petal.size, rotation, petal.color);
      });

      ctx.globalAlpha = 0.24;
      ctx.strokeStyle = 'rgba(143, 112, 94, 0.2)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 9; i += 1) {
        const y = height * (0.12 + i * 0.1) + Math.sin(time + i) * 10;
        ctx.beginPath();
        ctx.moveTo(-20, y);
        ctx.bezierCurveTo(width * 0.24, y + 30, width * 0.56, y - 34, width + 20, y + 8);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      if (!reduceMotion) {
        window.requestAnimationFrame(draw);
      }
    };

    resize();
    draw();
    window.addEventListener('resize', resize, { passive: true });

    if (!reduceMotion) {
      window.requestAnimationFrame(draw);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    initCountdown();
    initReveal();
    initHeader();
    initRsvpNavigation();
    initMap();
    initForm();
    initAmbientCanvas();
  });
})();
