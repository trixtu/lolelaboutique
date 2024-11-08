import { stripe } from "@/app/lib/stripe";
import React from "react";
import { unstable_noStore as noStore } from "next/cache";
import { Cart } from "@/app/lib/interfaces";
import { redis } from "@/app/lib/redis";
import StoreCheckoutForm from "@/app/components/storefront/StoreCheckoutForm";
import { cookies } from "next/headers";
import prisma from "@/app/lib/db";
import { auth } from "@/auth";

async function getData(userId: string) {
  const data = await prisma.address.findFirst({
    where:{userId:userId}
  })

  return data;
}

export default async function CeckoutPage() {
  noStore();
  const session = await auth();
  const user = session?.user;

  let userBazaDeDate = null;
  let address = null;

  if (user?.email) { 
    const userData = await prisma.user.findFirst({
      where: { email: user.email },
      select:{
        id:true,
        firstName:true,
        lastName:true,
        email:true,
        profileImage:true,
        address:true,
        persoanaJuridica:true,
        phone:true || undefined
      }
    });
  
    if (userData) {
      // Redă utilizatorul din baza de date
      address = await getData(userData.id)
      userBazaDeDate=userData
    } else {
      // Dacă utilizatorul nu a fost găsit în baza de date, gestionează eroarea
      console.log('User not found in the database.');
    }
  } else {
    // Dacă utilizatorul nu este autentificat sau nu are un email, aruncă o eroare sau redirecționează
    console.log('User is not authenticated or email is missing.');
  }

  const cookieStore = cookies();
  const cartId = cookieStore.get('cartId')?.value;

  const cart: Cart | null = await redis.get(`cart-${cartId}`);

  if (!cart) {
    return;
  }

  // Colectarea ID-urilor produselor
  const productIds = cart.items.map((item) => item.id);


  const totalAmount = cart.items.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

  const paymentIntent = await stripe.paymentIntents.create({
    amount: totalAmount * 100,
    currency: "ron",
    metadata: {
      productIds: productIds.join(","),
    },
  });

  if (paymentIntent.client_secret === null) {
    throw Error("Stripe failed to create payment intent");
  }

  return (
    <StoreCheckoutForm products={cart} user={userBazaDeDate} address={address} persoanaJuridica={userBazaDeDate?.persoanaJuridica}/>
  );
}
