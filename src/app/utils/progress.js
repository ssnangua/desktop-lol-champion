/**
 * progress bar
 */
const wrapper = document.createElement("div");
wrapper.classList.add("progress", "hide");
document.body.appendChild(wrapper);

const progress = document.createElement("progress");
wrapper.appendChild(progress);

const progressText = document.createElement("div");
progressText.classList.add("progress-text", "hide");
wrapper.appendChild(progressText);

export default {
  show(data) {
    this.update(data);
    wrapper.classList[data.modal ? "add" : "remove"]("modal");
    wrapper.classList[data.fixed ? "add" : "remove"]("fixed");
    wrapper.classList.remove("hide");
  },
  update({ max = 0, value = 0, text = "", html = "" }) {
    progress.max = max;
    progress.value = value;
    if (html || text) {
      progressText.classList.remove("hide");
      progressText.innerHTML = html || text;
      progressText.setAttribute("data-text", text);
    } else {
      progressText.classList.add("hide");
    }
  },
  hide() {
    wrapper.classList.add("hide");
  },
};
