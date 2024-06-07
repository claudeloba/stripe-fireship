import { serve } from "@hono/node-server";
import { Hono } from "hono";
import "dotenv/config";
import { Stripe } from "stripe";
import { HTTPException } from "hono/http-exception";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-04-10",
});

const app = new Hono();

app.post("/checkout", async (c) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price: "price_1PP67GKdDkqhHkXMnEzz1Tux",
          quantity: 1,
        },
      ],
      mode: "payment",
      cancel_url: "http://localhost:3000/cancel",
      success_url: "http://localhost:3000/success",
    });
    return c.json(session);
  } catch (error) {
    if (error instanceof Error) {
      throw new HTTPException(500, { message: error.message });
    }
  }
});

app.get("/success", (c) => {
  return c.text("Success!");
});

app.get("/cancel", (c) => {
  return c.text("Canceled!");
});

app.post("/webhook", async (c) => {
  const rawBody = await c.req.text();
  const signature = c.req.header("stripe-signature");

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature!,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (e) {
    if (e instanceof Error) {
      console.error(e.message);
      throw new HTTPException(400);
    }
  }

  if (event?.type === "checkout.session.completed") {
    const session = event.data.object;
    console.log(session);
  }

  return c.text("success!");
});

app.get("/", (c) => {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Checkout</title>
    <link href="css/style.css" rel="stylesheet" />
    <script src="https://js.stripe.com/v3/"></script>
  </head>
  <body>
    <h1>Checkout!</h1>
    <button id="checkout-btn">Checkout</button>

    <script>
      const checkoutBtn = document.querySelector("#checkout-btn");
      checkoutBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        const response = await fetch("http://localhost:3000/checkout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });

        const { id } = await response.json();
        const stripe = Stripe("${process.env.STRIPE_PUBLIC_KEY}");
        await stripe.redirectToCheckout({ sessionId: id });
      });
    </script>
  </body>
</html>`;

  return c.html(html);
});

const port = 3000;
console.log(`Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});
