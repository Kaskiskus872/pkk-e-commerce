// === Cart Logic ===
let cart = [];
const BASEURL = "http://localhost:8080/pkk-e-commerce-main/public";
const cartItemsElement = document.getElementById("cart-items");
const cartCountElement = document.getElementById("cart-count");
const totalPriceElement = document.getElementById("total-price");

document.addEventListener("DOMContentLoaded", function () {
    loadCartFromServer();

    document.querySelectorAll(".add-to-cart").forEach(btn => {
        btn.addEventListener("click", () => {
            const productId = btn.getAttribute("data-id");
            const productName = btn.getAttribute("data-name") || "Unknown";
            const productPrice = parseFloat(btn.getAttribute("data-price")) || 0;

            syncAddItemToServer(productId);
        });
    });
});

async function loadCartFromServer() {
    try {
        const response = await fetch(`${BASEURL}/Cart/getCart`);
        const data = await response.json();
        cart = data.items.map(item => ({
            id: item.product_id,
            item_id: item.item_id,
            name: item.title,
            price: parseFloat(item.price),
            quantity: item.quantity
        }));
        renderCartItems();
    } catch (err) {
        console.error("Gagal memuat keranjang:", err);
    }
}

function syncAddItemToServer(productId, quantity = 1) {
    fetch(`${BASEURL}/Cart/addItem`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            product_id: productId,
            quantity: quantity
        })
    }).then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    }).then(data => {
        if (data.success) {
            loadCartFromServer(); // Refresh cart after successful addition
        }
    }).catch(err => {
        console.error("Add item error:", err);
    });
}

function syncDecreaseItemFromServer(itemId) {
    fetch(`${BASEURL}/Cart/decreaseItem`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ item_id: itemId })
    }).then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    }).then(data => {
        if (data.success) {
            loadCartFromServer(); // Refresh cart after successful update
        }
    }).catch(err => {
        console.error("Decrease item error:", err);
    });
}

function syncDeleteItemFromServer(itemId) {
    fetch(`${BASEURL}/Cart/deleteItem`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ item_id: itemId })
    }).then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    }).then(data => {
        if (data.success) {
            loadCartFromServer(); // Refresh cart after successful deletion
        }
    }).catch(err => {
        console.error("Delete item error:", err);
    });
}

function renderCartItems() {
    cartItemsElement.innerHTML = "";
    let total = 0;
    let itemCount = 0;

    cart.forEach((item, index) => {
        const price = parseFloat(item.price);
        const quantity = item.quantity;
        const subtotal = price * quantity;
        total += subtotal;
        itemCount += quantity;

        const li = document.createElement("li");
        li.className =
            "list-group-item d-flex justify-content-between align-items-center";

        const itemInfo = document.createElement("div");
        itemInfo.className = "me-3";
        itemInfo.innerHTML = `<strong>${item.name}</strong><br>$${price.toFixed(
            2
        )} x ${quantity} = $${subtotal.toFixed(2)}`;

        const btnGroup = document.createElement("div");
        btnGroup.className = "btn-group";

        const minusBtn = document.createElement("button");
        minusBtn.className = "btn btn-sm btn-outline-secondary";
        minusBtn.textContent = "-";
        minusBtn.addEventListener("click", () => {
            syncDecreaseItemFromServer(item.item_id);
        });

        const plusBtn = document.createElement("button");
        plusBtn.className = "btn btn-sm btn-outline-secondary";
        plusBtn.textContent = "+";
        plusBtn.addEventListener("click", () => {
            syncAddItemToServer(item.id, 1);
        });

        const removeBtn = document.createElement("button");
        removeBtn.className = "btn btn-sm btn-danger";
        removeBtn.textContent = "Remove";
        removeBtn.addEventListener("click", () => {
            syncDeleteItemFromServer(item.item_id);
        });

        btnGroup.appendChild(minusBtn);
        btnGroup.appendChild(plusBtn);
        btnGroup.appendChild(removeBtn);

        li.appendChild(itemInfo);
        li.appendChild(btnGroup);
        cartItemsElement.appendChild(li);
    });

    totalPriceElement.textContent = total.toFixed(2);
    if (cartCountElement) {
        cartCountElement.textContent = itemCount;
    }
}



// === Filter Logic ===
const filters = {
    category: [],
    gender: []
};

function filterProducts() {
    const items = document.querySelectorAll(".product-item");
    items.forEach(item => {
        const category = item.getAttribute("data-category").toLowerCase();
        const gender = item.getAttribute("data-gender").toLowerCase();
        const matchCategory =
            filters.category.length === 0 ||
            filters.category.includes(category);
        const matchGender =
            filters.gender.length === 0 || filters.gender.includes(gender);
        item.style.display = matchCategory && matchGender ? "block" : "none";
    });
}

function toggleFilter(type, value) {
    const index = filters[type].indexOf(value);
    index === -1 ? filters[type].push(value) : filters[type].splice(index, 1);
    toggleButtonActive(type, value, index === -1);
    filterProducts();
}

function toggleButtonActive(type, value, isActive) {
    const button = document.querySelector(
        `.${type}-filter[data-${type}="${value}"]`
    );
    button.classList.toggle("active", isActive);
}

function clearFilters() {
    filters.category = [];
    filters.gender = [];
    document
        .querySelectorAll(".btn-outline-light")
        .forEach(btn => btn.classList.remove("active"));
    filterProducts();
}

// === Search Logic ===
function searchProducts() {
    const searchInput = document
        .getElementById("searchInput")
        .value.toLowerCase();
    const items = document.querySelectorAll(".product-item");

    items.forEach(item => {
        const title = item
            .querySelector(".card-title")
            .textContent.toLowerCase();
        const description = item
            .querySelector(".card-text")
            .textContent.toLowerCase();
        const match =
            title.includes(searchInput) || description.includes(searchInput);

        item.style.display = match ? "block" : "none";
        if (match) highlightSearchTerm(item, searchInput);
    });
}

function highlightSearchTerm(item, term) {
    ["card-title", "card-text"].forEach(cls => {
        const el = item.querySelector(`.${cls}`);
        el.innerHTML = el.textContent.replace(
            new RegExp(`(${term})`, "gi"),
            '<span class="highlight">$1</span>'
        );
    });
}

// === 3D Card Hover Effect ===
document.querySelectorAll(".card-3d.interactive").forEach(card => {
    card.addEventListener("mousemove", e => {
        const img = card.querySelector("img");
        const rect = card.getBoundingClientRect();
        const rotateX = (rect.height / 2 - (e.clientY - rect.top)) / 10;
        const rotateY = (e.clientX - rect.left - rect.width / 2) / 10;
        img.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });

    card.addEventListener("mouseleave", () => {
        card.querySelector("img").style.transform = "rotateX(0) rotateY(0)";
    });
});

// === DOM Ready Actions ===
document.addEventListener("DOMContentLoaded", () => {
    // Product Image Click - Modal Detail
    document.querySelectorAll(".product-img").forEach(img => {
        img.addEventListener("click", function () {
            document.getElementById("modalTitle").textContent =
                this.dataset.title;
            document.getElementById("modalPrice").textContent =
                this.dataset.price;
            document.getElementById("modalCategory").textContent =
                this.dataset.category;
            document.getElementById("modalGender").textContent =
                this.dataset.gender;
            document.getElementById("modalDescription").textContent =
                this.dataset.description || "No description available.";
            document.getElementById("modalStock").textContent =
                this.dataset.stock;
            document.getElementById("modalImage").src = this.dataset.image;
        });
    });
});

// === Auth Section Visibility ==
function showRegister() {
    document.getElementById("login-section").style.display = "none";
    document.getElementById("register-section").style.display = "block";
}

function showLogin() {
    document.getElementById("register-section").style.display = "none";
    document.getElementById("login-section").style.display = "block";
}

// === Modal Logic ===
function handleProductModalShow(event) {
    const button = $(event.relatedTarget);
    const modal = $(this);

    // Ambil data produk dari atribut data-*
    const userName = button.data("username");
    const userImage = button.data("userimage");
    const title = button.data("title");
    const price = button.data("price");
    const category = button.data("category");
    const description = button.data("description");
    const gender = button.data("gender");
    const image = button.data("image");
    const stock = button.data("stock");
    const rating = parseFloat(button.data("rating")) || 0;
    const ratingCount = button.data("ratingcount") || "";

    // Ambil product_id dan user_id
    const productId = button.data("productid");
    const userId = button.data("userid");

    // Isi data produk di modal
    setModalText(modal, {
        userName,
        userImage,
        title,
        price,
        category,
        description,
        gender,
        image,
        stock,
        rating,
        ratingCount
    });

    // Set hidden input di form rating
    modal.find("input[name='product_id']").val(productId);
    modal.find("input[name='user_id']").val(userId); // Opsional, jika tidak pakai session

    // Ambil dan render komentar
    const reviewersJson = button.attr("data-reviewers");
    renderProductReviews(modal, reviewersJson);
}

function setModalText(modal, data) {
    modal.find("#modalUsername").text(data.userName);
    modal.find("#modalUserImage").attr("src", data.userImage);
    modal.find("#modalTitle").text(data.title);
    modal.find("#modalPrice").text(data.price);
    modal.find("#modalCategory").text(data.category);
    modal.find("#modalDescription").text(data.description);
    modal.find("#modalGender").text(data.gender);
    modal.find("#modalImage").attr("src", data.image);
    modal.find("#modalStock").text(data.stock);

    const starsHtml = generateStarsHtml(data.rating);
    modal.find(".rating-stars-static").html(starsHtml);

    modal
        .find("#modalRating")
        .text(`${data.rating} / 5 (${data.ratingCount} reviews)`);
}

function generateStarsHtml(rating) {
    const maxStars = 5;
    let stars = "";
    for (let i = 1; i <= maxStars; i++) {
        if (i <= Math.floor(rating)) {
            stars += '<i class="bi bi-star-fill"></i>';
        } else if (i - rating < 1) {
            stars += '<i class="bi bi-star-half"></i>';
        } else {
            stars += '<i class="bi bi-star"></i>';
        }
    }
    return stars;
}

function renderProductReviews(modal, reviewersJson) {
    const commentsContainer = modal.find("#modalCommentsContainer");
    commentsContainer.empty();

    let reviewers = [];
    try {
        reviewers = JSON.parse(reviewersJson);
    } catch (e) {
        console.error("Invalid reviewers JSON", e);
    }

    if (!reviewers.length) {
        commentsContainer.html('<p class="text-muted">Belum ada review</p>');
        return;
    }

    reviewers.forEach(reviewer => {
        const stars = generateStarsHtml(reviewer.rating || 0);
        const commentHtml = `
            <div class="d-flex align-items-start mb-3">
                <img src="${reviewer.userImage}" class="rounded-circle me-2" alt="User" width="40" height="40">
                <div>
                    <strong>${reviewer.username}</strong>
                    <div class="text-warning rating-stars-static">${stars}</div>
                    <p class="review-comment mb-0">${reviewer.review}</p>
                </div>
            </div>
        `;
        commentsContainer.append(commentHtml);
    });
}

// Pasang handler saat modal ditampilkan
$("#productModal").on("show.bs.modal", handleProductModalShow);

//input rating
$(document).ready(function () {
    // Fungsi handle modal produk (sudah kamu tulis dengan baik)
    $("#productModal").on("show.bs.modal", handleProductModalShow);

    // Handle klik bintang untuk input rating
    $("#starInput i").on("click", function () {
        const rating = $(this).data("value");
        $("#ratingValue").val(rating); // Set nilai ke hidden input
        updateStarUI(rating);
    });

    // Fungsi untuk update tampilan bintang saat diklik
    function updateStarUI(rating) {
        $("#starInput i").each(function () {
            const starValue = $(this).data("value");
            if (starValue <= rating) {
                $(this).removeClass("bi-star").addClass("bi-star-fill");
            } else {
                $(this).removeClass("bi-star-fill").addClass("bi-star");
            }
        });
    }

    // Optional: reset tampilan bintang dan form saat modal ditutup
    $("#productModal").on("hidden.bs.modal", function () {
        $("#ratingValue").val(""); // Reset hidden rating
        updateStarUI(0); // Reset tampilan bintang
        $("#ratingForm textarea[name='review_text']").val(""); // Kosongkan komentar
    });
});
