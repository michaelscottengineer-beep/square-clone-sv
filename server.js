require("dotenv").config();
const express = require("express");
const app = express();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const bodyParser = require("body-parser");
const cors = require("cors");
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const { env } = require("./src/config");
const { transporter } = require("./src/lib/nodemailer");
const io = new Server(server, {
  cors: {
    origin: [env.CLIENT_BASE_URL],
  },
});

app.use(cors());

app.use(express.json());
// app.use(express.urlencoded({ extended: true })); // instead of bodyParser

// app.use(bodyParser.urlencoded({ extended: true }));
app.post("/create-customer", async (req, res, next) => {
  try {
    const customer = await stripe.customers.create({
      name: "Minh Nguyen",
      email: "minhnguyen@example.com",
      balance: 30000000000,
    });

    res.status(200).json(customer);
  } catch (err) {
    next(err);
  }
});
//
app.post("/create_payment_method", async (req, res, next) => {
  try {
    const data = req.body;
    // const paymentMethods = await stripe.paymentMethods.attach(data);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 500,
      currency: "usd",
      payment_method: "pm_card_visa",
      payment_method_types: ["card"],
    });

    res.json(paymentMethods);
  } catch (err) {
    next(err);
  }
});
app.get("/billings/transactions", async (req, res, next) => {
  try {
    const { customerId } = req.query;
    console.log(customerId);
    const paymentIntents = await stripe.paymentIntents.list({
      customer: customerId,
      limit: 20,
    });

    const transactions = await Promise.all(
      paymentIntents.data.map(async (ts) => {
        let paymentMethod = null;

        // Check nếu có payment_method
        if (ts.payment_method) {
          try {
            // ĐÚNG: dùng stripe.paymentMethods.retrieve()
            paymentMethod = await stripe.paymentMethods.retrieve(
              ts.payment_method
            );
          } catch (err) {
            console.error("Error retrieving payment method:", err.message);
          }
        }

        return {
          ...ts,
          amount: ts.amount / 100,
          userPaymentMethod: paymentMethod, // Hoặc pp nếu bạn muốn giữ tên cũ
        };
      })
    );

    res.status(200).json({
      data: transactions,
    });
  } catch (err) {
    next(err);
  }
});
app.post("/payment_methods", async (req, res, next) => {
  try {
    const { customerId } = req.body;
    const paymentMethods = await stripe.customers.listPaymentMethods(
      customerId,
      {
        limit: 3,
      }
    );

    res.json(paymentMethods);
  } catch (err) {
    console.log(err);
    next(err);
  }
});

app.post("/create-checkout-session", async (req, res) => {
  const {
    line_items,
    orderId,
    shopId,
    customerId = "cus_TQ00ka7jjNyZ8e",
  } = req.body;

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    line_items,
    mode: "payment",
    invoice_creation: {
      enabled: true,
      invoice_data: {
        description: "paid for order " + orderId + " at " + shopId,
      },
    },
    metadata: {
      orderId,
      shopId,
    },
    payment_intent_data: {
      metadata: {
        shopId,
        orderId,
        description: "paid for order " + orderId + " at " + shopId,
      },
    },
    payment_method_types: ["card"],
    success_url: `${process.env.CLIENT_BASE_URL}/checkout/success?orderId=${orderId}&shopId=${shopId}`,
    cancel_url: `${process.env.CLIENT_BASE_URL}/checkout/cancel?orderId=${orderId}&shopId=${shopId}`,
  });

  res.json({
    url: session.url,
  });
});

app.post("/staff-inviting", async (req, res, next) => {
  try {
    const { email, invitingId, restaurantName } = req.body;
    transporter.sendMail({
      to: email,
      subject: "Setup your Account to join " + restaurantName,
      html: `Please setup your account by clicking the link bellow: <br> <a href="${
        process.env.CLIENT_BASE_URL + "/setup/" + invitingId
      }"><b>Link to setup</b></a>`,
    });

    res.status(200).json({
      message: "Sent!",
    });
  } catch (err) {
    next(err);
  }
});

// #region Socket IO

io.on("connection", (socket) => {
  console.log("a user connected");
});

io.of("/orders").on("connection", (socket) => {
  console.log("connected", socket.id);
  socket.on("order:user-create", (orderDocumentData) => {
    io.of("/orders").emit("admin:receive-order", orderDocumentData);
    console.log("received orderDocumentData", orderDocumentData);
  });
});
io.of("/invoice-preview").on("connection", (socket) => {
  console.log("connected invoice", socket.id);
  socket.on("invoice:preview", (orderInvoice) => {
    io.of("/invoice-preview").emit("customer:invoice-viewer", orderInvoice);
    console.log("received orderInvoice", orderInvoice);
  });

  socket.on("invoice:customer-confirmation", ({ isConfirmed }) => {
    io.of("/invoice-preview").emit("invoice:customer-confirmed", isConfirmed);
  });
});

// #endregion

const port = process.env.PORT || 3090;
server.listen(port, () => console.log("Server is running..."));
