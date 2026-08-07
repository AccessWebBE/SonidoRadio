// Wanneer mag het hoofdvenster de splash vervangen?
//
// 'ready-to-show' is niet betrouwbaar: op Windows komt het na een halve
// seconde, op Linux komt het bij een verborgen venster helemaal niet, omdat
// Chromium zo'n venster niet schildert. Daarom luisteren we ook naar
// 'did-finish-load' en houden we een noodtermijn aan.
//
// De ondergrens voorkomt het omgekeerde probleem: een splash die zo kort
// oplicht dat hij als een glitch leest.

const createRevealScheduler = ({
  minDelayMs,
  maxDelayMs,
  reveal,
  now = Date.now,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
}) => {
  const startedAt = now();
  let timer = null;
  let revealed = false;

  const clearTimer = () => {
    if (timer) {
      clearTimeoutFn(timer);
      timer = null;
    }
  };

  const schedule = (delay) => {
    clearTimer();
    timer = setTimeoutFn(run, delay);
    timer?.unref?.();
  };

  function run() {
    if (revealed) {
      return;
    }

    const remaining = minDelayMs - (now() - startedAt);
    if (remaining > 0) {
      schedule(remaining);
      return;
    }

    revealed = true;
    clearTimer();
    reveal();
  }

  schedule(maxDelayMs);

  return {
    request: run,
    cancel: () => {
      revealed = true;
      clearTimer();
    },
  };
};

module.exports = { createRevealScheduler };
