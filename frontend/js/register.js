document.addEventListener("DOMContentLoaded", function () {

    // ==============================
    // GET ELEMENTS
    // ==============================

    const steps = document.querySelectorAll(".form-step");
    const indicators = document.querySelectorAll(".step-indicator");

    const nextButtons = document.querySelectorAll(".btn-next");
    const prevButtons = document.querySelectorAll(".btn-prev");

    const roleOptions = document.querySelectorAll(".role-option");

    const registerForm = document.getElementById("registerForm");
    const dynamicFields = document.getElementById("dynamic-fields");
    const errorMsg = document.getElementById("errorMsg");

    let currentStep = 0;
    let selectedRole = "farmer";


    // ==============================
    // INITIALIZE
    // ==============================

    showStep(currentStep);
    updateDynamicFields();


    // ==============================
    // ROLE SELECTION
    // ==============================

    roleOptions.forEach(function (option) {

        option.addEventListener("click", function () {

            roleOptions.forEach(function (item) {
                item.classList.remove("selected");
            });

            option.classList.add("selected");

            selectedRole = option.dataset.role;

            console.log("Selected role:", selectedRole);

            updateDynamicFields();

        });

    });


    // ==============================
    // NEXT BUTTONS
    // ==============================

    nextButtons.forEach(function (button) {

        button.addEventListener("click", function (event) {

            event.preventDefault();

            console.log("Next clicked. Current step:", currentStep);

            // Validate current step
            if (!validateStep(currentStep)) {
                return;
            }

            if (currentStep < steps.length - 1) {

                currentStep++;

                // Fill confirmation page before showing Step 4
                if (currentStep === 3) {
                    populateSummary();
                }

                showStep(currentStep);
            }

        });

    });


    // ==============================
    // PREVIOUS BUTTONS
    // ==============================

    prevButtons.forEach(function (button) {

        button.addEventListener("click", function (event) {

            event.preventDefault();

            if (currentStep > 0) {

                currentStep--;

                showStep(currentStep);

            }

        });

    });


    // ==============================
    // SHOW STEP
    // ==============================

    function showStep(index) {

        steps.forEach(function (step, i) {

            if (i === index) {

                step.style.display = "block";
                step.classList.add("active");

            } else {

                step.style.display = "none";
                step.classList.remove("active");

            }

        });


        // Update indicators

        indicators.forEach(function (indicator, i) {

            indicator.classList.remove(
                "active",
                "completed"
            );

            if (i === index) {

                indicator.classList.add("active");

            }

            else if (i < index) {

                indicator.classList.add("completed");
                indicator.textContent = "✓";

            }

            else {

                indicator.textContent = i + 1;

            }

        });

    }


    // ==============================
    // DYNAMIC ROLE FIELDS
    // ==============================

    function updateDynamicFields() {

        if (!dynamicFields) {
            return;
        }

        dynamicFields.innerHTML = "";


        // ==============================
        // FARMER
        // ==============================

        if (selectedRole === "farmer") {

            dynamicFields.innerHTML = `
                <div class="input-group">
                    <label for="crop">
                        Primary Crop (Optional)
                    </label>

                    <input
                        type="text"
                        id="crop"
                        placeholder="e.g. Wheat, Rice"
                    >
                </div>
            `;

        }


        // ==============================
        // BUYER
        // ==============================

        else if (selectedRole === "buyer") {

            dynamicFields.innerHTML = `

                <div class="input-group">

                    <label for="company">
                        Company / Business Name
                    </label>

                    <input
                        type="text"
                        id="company"
                        placeholder="e.g. Fresh Foods Ltd"
                        required
                    >

                </div>


                <div class="input-group">

                    <label for="buyerAddress">
                        Business Address
                    </label>

                    <input
                        type="text"
                        id="buyerAddress"
                        placeholder="Enter your business address"
                        required
                    >

                </div>


                <div class="input-group">

                    <label for="buyerDistrict">
                        District
                    </label>

                    <input
                        type="text"
                        id="buyerDistrict"
                        placeholder="e.g. Paschim Bardhaman"
                        required
                    >

                </div>


                <div class="input-group">

                    <label for="buyerState">
                        State
                    </label>

                    <input
                        type="text"
                        id="buyerState"
                        placeholder="e.g. West Bengal"
                        value="West Bengal"
                        required
                    >

                </div>

            `;

        }


        // ==============================
        // FPO
        // ==============================

        else if (selectedRole === "fpo") {

            dynamicFields.innerHTML = `

                <div class="input-group">

                    <label for="farmersCount">
                        Number of Farmers
                    </label>

                    <input
                        type="number"
                        id="farmersCount"
                        placeholder="e.g. 50"
                        min="1"
                    >

                </div>

            `;

        }

    }


    // ==============================
    // VALIDATION
    // ==============================

    function validateStep(step) {


        // ==============================
        // STEP 1
        // ==============================

        if (step === 0) {

            if (!selectedRole) {

                alert("Please select a role.");

                return false;

            }

            return true;

        }


        // ==============================
        // STEP 2
        // ==============================

        if (step === 1) {

            const name =
                document.getElementById("name").value.trim();

            const email =
                document.getElementById("email").value.trim();

            const mobile =
                document.getElementById("mobile").value.trim();

            const password =
                document.getElementById("password").value;


            if (!name || !email || !mobile || !password) {

                alert("Please fill in all fields.");

                return false;

            }


            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {

                alert("Please enter a valid email address.");

                return false;

            }


            if (!/^\d{10}$/.test(mobile)) {

                alert("Please enter a valid 10-digit mobile number.");

                return false;

            }


            if (password.length < 6) {

                alert("Password must contain at least 6 characters.");

                return false;

            }


            return true;

        }


        // ==============================
        // STEP 3
        // ==============================

        if (step === 2) {

            const location =
                document.getElementById("location").value.trim();


            if (!location) {

                alert("Please enter your location.");

                return false;

            }


            // ==============================
            // BUYER VALIDATION
            // ==============================

            if (selectedRole === "buyer") {

                const company =
                    document.getElementById("company").value.trim();

                const address =
                    document.getElementById("buyerAddress").value.trim();

                const district =
                    document.getElementById("buyerDistrict").value.trim();

                const state =
                    document.getElementById("buyerState").value.trim();


                if (!company || !address || !district || !state) {

                    alert("Please fill in all Buyer details.");

                    return false;

                }

            }


            // ==============================
            // FPO VALIDATION
            // ==============================

            if (selectedRole === "fpo") {

                const farmersCount =
                    document.getElementById("farmersCount").value.trim();


                if (!farmersCount || Number(farmersCount) < 1) {

                    alert("Please enter the number of farmers.");

                    return false;

                }

            }


            return true;

        }


        return true;

    }


    // ==============================
    // SUMMARY
    // ==============================

    function populateSummary() {

        const role =
            document.getElementById("summary-role");

        const name =
            document.getElementById("summary-name");

        const email =
            document.getElementById("summary-email");

        const mobile =
            document.getElementById("summary-mobile");


        if (role) {

            role.textContent = selectedRole;

        }


        if (name) {

            name.textContent =
                document.getElementById("name").value;

        }


        if (email) {

            email.textContent =
                document.getElementById("email").value;

        }


        if (mobile) {

            mobile.textContent =
                document.getElementById("mobile").value;

        }

    }


    // ==============================
    // FORM SUBMISSION
    // ==============================

    registerForm.addEventListener("submit", async function (event) {

        event.preventDefault();


        populateSummary();


        const name =
            document.getElementById("name").value.trim();

        const email =
            document.getElementById("email").value.trim();

        const mobile =
            document.getElementById("mobile").value.trim();

        const password =
            document.getElementById("password").value;

        const location =
            document.getElementById("location").value.trim();


        // ==============================
        // BASIC PAYLOAD
        // ==============================

        const payload = {

            name: name,

            email: email,

            password: password,

            role: selectedRole,

            mobile: mobile,

            location: location

        };


        // ==============================
        // FARMER DETAILS
        // ==============================

        if (selectedRole === "farmer") {

            const crop =
                document.getElementById("crop");

            if (crop) {

                payload.crop =
                    crop.value.trim();

            }

        }


        // ==============================
        // BUYER DETAILS
        // ==============================

        if (selectedRole === "buyer") {

            const company =
                document.getElementById("company");

            const address =
                document.getElementById("buyerAddress");

            const district =
                document.getElementById("buyerDistrict");

            const state =
                document.getElementById("buyerState");


            if (company) {

                payload.company =
                    company.value.trim();

            }


            if (address) {

                payload.address =
                    address.value.trim();

            }


            if (district) {

                payload.district =
                    district.value.trim();

            }


            if (state) {

                payload.state =
                    state.value.trim();

            }

        }


        // ==============================
        // FPO DETAILS
        // ==============================

        if (selectedRole === "fpo") {

            const farmersCount =
                document.getElementById("farmersCount");


            if (farmersCount) {

                payload.farmersCount =
                    farmersCount.value;

            }

        }


        // ==============================
        // SUBMIT BUTTON
        // ==============================

        const submitButton =
            registerForm.querySelector(
                'button[type="submit"]'
            );


        const originalText =
            submitButton.textContent;


        submitButton.textContent =
            "Creating Account...";

        submitButton.disabled = true;


        // ==============================
        // SEND TO BACKEND
        // ==============================

        try {

            const response = await fetch(
                "http://localhost:5000/api/auth/register",
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify(payload)
                }
            );


            const data =
                await response.json();


            if (!response.ok) {

                if (errorMsg) {

                    errorMsg.textContent =
                        data.message ||
                        "Registration failed.";

                }

                return;

            }


            // ==============================
            // SAVE USER DATA
            // ==============================

            localStorage.setItem(
                "agrilink_role",
                selectedRole
            );


            localStorage.setItem(
                "agrilink_user",
                name
            );


            localStorage.setItem(
                "agrilink_email",
                email
            );


            // ==============================
            // SUCCESS
            // ==============================

            alert(
                "Registration successful! Please log in."
            );


            window.location.href =
                "index.html";

        }


        catch (error) {

            console.error(
                "Registration error:",
                error
            );


            if (errorMsg) {

                errorMsg.textContent =
                    "Unable to connect to backend. Make sure the server is running.";

            }

        }


        finally {

            submitButton.textContent =
                originalText;

            submitButton.disabled = false;

        }

    });

});