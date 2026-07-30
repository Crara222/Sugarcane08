(function () {
  "use strict";

  var ITEMS_KEY = "coordi.items.v1";
  var FAVORITES_KEY = "coordi.favorites.v1";
  var DISLIKED_KEY = "coordi.disliked.v1";

  var CATEGORIES = ["상의", "하의", "아우터", "신발", "액세서리"];
  var REQUIRED_CATEGORIES = ["상의", "하의", "신발"];
  var OPTIONAL_CATEGORIES = ["아우터", "액세서리"];
  var MAX_DISLIKE_RETRIES = 30;

  var state = {
    items: loadJSON(ITEMS_KEY, []),
    favorites: loadJSON(FAVORITES_KEY, []),
    dislikedCombos: loadJSON(DISLIKED_KEY, []),
    currentOutfit: null, // { 상의: item|null, 하의: item|null, ... }
    selectedSeason: getCurrentSeason(),
    editingItemId: null
  };

  var els = {
    itemForm: document.getElementById("itemForm"),
    itemCategory: document.getElementById("itemCategory"),
    itemName: document.getElementById("itemName"),
    itemColor: document.getElementById("itemColor"),
    itemSeasons: document.getElementById("itemSeasons"),
    itemSituations: document.getElementById("itemSituations"),
    itemSubmitBtn: document.getElementById("itemSubmitBtn"),
    itemCancelBtn: document.getElementById("itemCancelBtn"),
    closetList: document.getElementById("closetList"),
    seasonFilter: document.getElementById("seasonFilter"),
    situationFilter: document.getElementById("situationFilter"),
    includeOuter: document.getElementById("includeOuter"),
    includeAccessory: document.getElementById("includeAccessory"),
    outfitResult: document.getElementById("outfitResult"),
    recommendBtn: document.getElementById("recommendBtn"),
    saveFavoriteBtn: document.getElementById("saveFavoriteBtn"),
    dislikeOutfitBtn: document.getElementById("dislikeOutfitBtn"),
    favoriteList: document.getElementById("favoriteList")
  };

  function loadJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function saveItems() {
    localStorage.setItem(ITEMS_KEY, JSON.stringify(state.items));
  }

  function saveFavorites() {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(state.favorites));
  }

  function saveDisliked() {
    localStorage.setItem(DISLIKED_KEY, JSON.stringify(state.dislikedCombos));
  }

  function makeId() {
    return Date.now() + "-" + Math.random().toString(36).slice(2, 8);
  }

  function itemsByCategory(category) {
    return state.items.filter(function (it) { return it.category === category; });
  }

  function getCurrentSeason() {
    var month = new Date().getMonth() + 1;
    if (month >= 3 && month <= 5) return "봄";
    if (month >= 6 && month <= 8) return "여름";
    if (month >= 9 && month <= 11) return "가을";
    return "겨울";
  }

  // items with no season tags are treated as all-season and match any filter
  function itemsForSeason(category) {
    var items = itemsByCategory(category);
    if (state.selectedSeason === "전체") return items;
    return items.filter(function (it) {
      return !it.seasons || it.seasons.length === 0 || it.seasons.indexOf(state.selectedSeason) !== -1;
    });
  }

  function getCheckedValues(container) {
    var values = [];
    container.querySelectorAll("input[type=checkbox]:checked").forEach(function (box) {
      values.push(box.value);
    });
    return values;
  }

  // items with no situation tags are treated as all-purpose and match any filter
  function itemsForRecommend(category) {
    var items = itemsForSeason(category);
    var selectedSituations = getCheckedValues(els.situationFilter);
    if (selectedSituations.length === 0) return items;
    return items.filter(function (it) {
      return !it.situations || it.situations.length === 0 || it.situations.some(function (s) {
        return selectedSituations.indexOf(s) !== -1;
      });
    });
  }

  function setSeasonFilter(value) {
    state.selectedSeason = value;
    els.seasonFilter.querySelectorAll(".segmented-btn").forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.value === value);
    });
  }

  function pickRandom(arr) {
    if (arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function formatDate(ts) {
    var d = new Date(ts);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function resetCheckboxes(container) {
    container.querySelectorAll("input[type=checkbox]").forEach(function (box) {
      box.checked = false;
    });
  }

  function buildTags(it) {
    var tags = [];
    if (it.seasons && it.seasons.length > 0) tags = tags.concat(it.seasons);
    if (it.situations && it.situations.length > 0) tags = tags.concat(it.situations);
    return tags;
  }

  function appendTagRow(parentEl, tags) {
    if (!tags || tags.length === 0) return;
    var row = document.createElement("div");
    row.className = "item-tags";
    tags.forEach(function (t) {
      var tag = document.createElement("span");
      tag.className = "item-tag";
      tag.textContent = t;
      row.appendChild(tag);
    });
    parentEl.appendChild(row);
  }

  // --- closet ---

  function addItem(item) {
    state.items.push(item);
    saveItems();
    renderCloset();
  }

  function updateItem(id, changes) {
    var item = state.items.find(function (it) { return it.id === id; });
    if (!item) return;
    Object.assign(item, changes);
    saveItems();
    renderCloset();
    if (state.currentOutfit) renderOutfit();
  }

  function startEditItem(id) {
    var item = state.items.find(function (it) { return it.id === id; });
    if (!item) return;

    state.editingItemId = id;
    els.itemCategory.value = item.category;
    els.itemName.value = item.name;
    els.itemColor.value = item.color || "";

    resetCheckboxes(els.itemSeasons);
    (item.seasons || []).forEach(function (s) {
      var box = els.itemSeasons.querySelector('input[value="' + s + '"]');
      if (box) box.checked = true;
    });

    resetCheckboxes(els.itemSituations);
    (item.situations || []).forEach(function (s) {
      var box = els.itemSituations.querySelector('input[value="' + s + '"]');
      if (box) box.checked = true;
    });

    els.itemSubmitBtn.textContent = "수정하기";
    els.itemCancelBtn.classList.remove("hidden");
    els.itemName.focus();
  }

  function cancelEdit() {
    state.editingItemId = null;
    els.itemForm.reset();
    resetCheckboxes(els.itemSeasons);
    resetCheckboxes(els.itemSituations);
    els.itemSubmitBtn.textContent = "추가하기";
    els.itemCancelBtn.classList.add("hidden");
  }

  function deleteItem(id) {
    state.items = state.items.filter(function (it) { return it.id !== id; });
    saveItems();
    renderCloset();

    if (state.editingItemId === id) cancelEdit();

    if (state.currentOutfit) {
      var stillValid = CATEGORIES.every(function (cat) {
        var it = state.currentOutfit[cat];
        return !it || it.id !== id;
      });
      if (!stillValid) {
        state.currentOutfit = null;
        renderOutfit();
      }
    }
  }

  function renderCloset() {
    els.closetList.innerHTML = "";

    if (state.items.length === 0) {
      var p = document.createElement("p");
      p.className = "empty-msg";
      p.id = "closetEmptyMsg";
      p.textContent = "등록된 옷이 없습니다.";
      els.closetList.appendChild(p);
      return;
    }

    CATEGORIES.forEach(function (cat) {
      var items = itemsByCategory(cat);
      if (items.length === 0) return;

      var group = document.createElement("div");

      var title = document.createElement("div");
      title.className = "closet-group-title";
      title.textContent = cat + " (" + items.length + ")";
      group.appendChild(title);

      var chips = document.createElement("div");
      chips.className = "closet-chips";

      items.forEach(function (it) {
        var chip = document.createElement("div");
        chip.className = "closet-chip";

        var topRow = document.createElement("div");
        topRow.className = "closet-chip-top";

        var name = document.createElement("span");
        name.className = "closet-chip-name";
        name.textContent = it.name;
        topRow.appendChild(name);

        if (it.color) {
          var color = document.createElement("span");
          color.className = "closet-chip-color";
          color.textContent = it.color;
          topRow.appendChild(color);
        }

        var edit = document.createElement("button");
        edit.className = "chip-delete";
        edit.setAttribute("aria-label", "수정");
        edit.textContent = "✎";
        edit.addEventListener("click", function () { startEditItem(it.id); });
        topRow.appendChild(edit);

        var del = document.createElement("button");
        del.className = "chip-delete";
        del.setAttribute("aria-label", "삭제");
        del.textContent = "✕";
        del.addEventListener("click", function () { deleteItem(it.id); });
        topRow.appendChild(del);

        chip.appendChild(topRow);
        appendTagRow(chip, buildTags(it));

        chips.appendChild(chip);
      });

      group.appendChild(chips);
      els.closetList.appendChild(group);
    });
  }

  // --- recommend ---

  function outfitComboKey(outfit) {
    return CATEGORIES
      .map(function (cat) { return outfit[cat] ? outfit[cat].id : null; })
      .filter(Boolean)
      .sort()
      .join(",");
  }

  function isDislikedCombo(outfit) {
    var key = outfitComboKey(outfit);
    return state.dislikedCombos.indexOf(key) !== -1;
  }

  function buildRandomOutfit() {
    var outfit = {};
    REQUIRED_CATEGORIES.forEach(function (cat) {
      outfit[cat] = pickRandom(itemsForRecommend(cat));
    });

    outfit["아우터"] = els.includeOuter.checked ? pickRandom(itemsForRecommend("아우터")) : null;
    outfit["액세서리"] = els.includeAccessory.checked ? pickRandom(itemsForRecommend("액세서리")) : null;
    return outfit;
  }

  function generateOutfit() {
    var missingRequired = REQUIRED_CATEGORIES.filter(function (cat) {
      return itemsForRecommend(cat).length === 0;
    });

    if (missingRequired.length > 0) {
      state.currentOutfit = null;
      var reasons = missingRequired.map(function (cat) {
        if (itemsByCategory(cat).length === 0) return cat + "(미등록)";
        return (state.selectedSeason === "전체" ? cat : state.selectedSeason + " " + cat) + "(없음)";
      });
      renderOutfit("옷장을 확인해주세요: " + reasons.join(", "));
      return;
    }

    var outfit = buildRandomOutfit();
    var attempts = 0;
    while (isDislikedCombo(outfit) && attempts < MAX_DISLIKE_RETRIES) {
      outfit = buildRandomOutfit();
      attempts += 1;
    }

    state.currentOutfit = outfit;
    renderOutfit();
  }

  function renderOutfit(message) {
    els.outfitResult.innerHTML = "";

    if (!state.currentOutfit) {
      var p = document.createElement("p");
      p.className = "empty-msg";
      p.textContent = message || "상의·하의·신발을 옷장에 먼저 등록해주세요.";
      els.outfitResult.appendChild(p);
      els.saveFavoriteBtn.disabled = true;
      els.dislikeOutfitBtn.disabled = true;
      return;
    }

    CATEGORIES.forEach(function (cat) {
      var it = state.currentOutfit[cat];
      if (!it) return;

      var slot = document.createElement("div");
      slot.className = "outfit-slot";

      var catEl = document.createElement("div");
      catEl.className = "outfit-slot-category";
      catEl.textContent = cat;

      var nameEl = document.createElement("div");
      nameEl.className = "outfit-slot-name";
      nameEl.textContent = it.name;

      slot.appendChild(catEl);
      slot.appendChild(nameEl);

      if (it.color) {
        var colorEl = document.createElement("div");
        colorEl.className = "outfit-slot-color";
        var dot = document.createElement("span");
        dot.className = "color-dot";
        colorEl.appendChild(dot);
        var colorText = document.createElement("span");
        colorText.textContent = it.color;
        colorEl.appendChild(colorText);
        slot.appendChild(colorEl);
      }

      appendTagRow(slot, buildTags(it));

      els.outfitResult.appendChild(slot);
    });

    els.saveFavoriteBtn.disabled = false;
    els.dislikeOutfitBtn.disabled = false;
  }

  function dislikeOutfit() {
    if (!state.currentOutfit) return;

    var key = outfitComboKey(state.currentOutfit);
    if (key && state.dislikedCombos.indexOf(key) === -1) {
      state.dislikedCombos.push(key);
      saveDisliked();
    }

    generateOutfit();
  }

  // --- favorites ---

  function saveFavorite() {
    if (!state.currentOutfit) return;

    var slots = CATEGORIES
      .map(function (cat) {
        var it = state.currentOutfit[cat];
        return it ? {
          category: cat,
          name: it.name,
          color: it.color || "",
          tags: buildTags(it)
        } : null;
      })
      .filter(Boolean);

    state.favorites.unshift({
      id: makeId(),
      createdAt: Date.now(),
      slots: slots
    });

    saveFavorites();
    renderFavorites();
  }

  function deleteFavorite(id) {
    state.favorites = state.favorites.filter(function (f) { return f.id !== id; });
    saveFavorites();
    renderFavorites();
  }

  function renderFavorites() {
    els.favoriteList.innerHTML = "";

    if (state.favorites.length === 0) {
      var li = document.createElement("li");
      li.className = "empty-msg";
      li.id = "favoriteEmptyMsg";
      li.textContent = "저장된 코디가 없습니다.";
      els.favoriteList.appendChild(li);
      return;
    }

    state.favorites.forEach(function (fav) {
      var li = document.createElement("li");
      li.className = "favorite-item";

      var top = document.createElement("div");
      top.className = "favorite-item-top";

      var date = document.createElement("span");
      date.className = "favorite-item-date";
      date.textContent = formatDate(fav.createdAt);
      top.appendChild(date);

      var del = document.createElement("button");
      del.className = "chip-delete";
      del.setAttribute("aria-label", "삭제");
      del.textContent = "✕";
      del.addEventListener("click", function () { deleteFavorite(fav.id); });
      top.appendChild(del);

      var names = document.createElement("div");
      names.className = "favorite-item-names";
      names.textContent = fav.slots.map(function (s) {
        var tagText = s.tags && s.tags.length > 0 ? " [" + s.tags.join(", ") + "]" : "";
        return s.category + ": " + s.name + (s.color ? " (" + s.color + ")" : "") + tagText;
      }).join(" · ");

      li.appendChild(top);
      li.appendChild(names);
      els.favoriteList.appendChild(li);
    });
  }

  // --- events ---

  els.itemForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var name = els.itemName.value.trim();
    if (!name) return;

    var fields = {
      category: els.itemCategory.value,
      name: name,
      color: els.itemColor.value.trim(),
      seasons: getCheckedValues(els.itemSeasons),
      situations: getCheckedValues(els.itemSituations)
    };

    if (state.editingItemId) {
      updateItem(state.editingItemId, fields);
      cancelEdit();
    } else {
      fields.id = makeId();
      fields.createdAt = Date.now();
      addItem(fields);
      els.itemName.value = "";
      els.itemColor.value = "";
      resetCheckboxes(els.itemSeasons);
      resetCheckboxes(els.itemSituations);
      els.itemName.focus();
    }
  });

  els.itemCancelBtn.addEventListener("click", cancelEdit);

  els.seasonFilter.querySelectorAll(".segmented-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      setSeasonFilter(btn.dataset.value);
      if (state.currentOutfit) generateOutfit();
    });
  });

  els.situationFilter.querySelectorAll("input[type=checkbox]").forEach(function (box) {
    box.addEventListener("change", function () {
      if (state.currentOutfit) generateOutfit();
    });
  });

  els.recommendBtn.addEventListener("click", generateOutfit);
  els.saveFavoriteBtn.addEventListener("click", saveFavorite);
  els.dislikeOutfitBtn.addEventListener("click", dislikeOutfit);

  // --- init ---
  setSeasonFilter(state.selectedSeason);
  renderCloset();
  renderOutfit();
  renderFavorites();
})();
