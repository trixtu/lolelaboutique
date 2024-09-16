"use server"


import { AuthError } from "next-auth";

import * as z from "zod"
import { signIn } from '@/auth';
import { getUserByEmail } from "@/data/user";

import { getTwoFactorConfirmationByUserId } from "@/data/two-factor-confirmation";
import prisma from '../lib/db';
import { LoginSchema } from "../lib/zodSchemas";
import { getFactorTokenByEmail } from '../../data/two-factor-token';

import { sendTwoFactorTokenEmail, sentVerificationEmail } from "@/lib/mail";
import { generateTwoFactorToken, generateVerificationToken } from "@/lib/tokens";



export const login = async (values:z.infer<typeof LoginSchema>,callbackUrl?:string | null)  => {
  const validatedFields = LoginSchema.safeParse(values)

  if (!validatedFields.success) {
    return { error: "Invalid fields"}
  }

  const { email, password, code } = validatedFields.data;

  const existingUser = await getUserByEmail(email);

  if (!existingUser || !existingUser.email || !existingUser.password) {
    return {error: "Invalid credentials!"}
  }

  if (!existingUser.emailVerified) {
    const verificationToken =await generateVerificationToken(existingUser.email);

    await sentVerificationEmail(verificationToken.email, verificationToken.token)
    
    return {success:"Confirmation email sent!"}
  }

  if(existingUser.isTwoFactorEnabled && existingUser.email) {
    if (code) {
      const twoFactorToken = await getFactorTokenByEmail(existingUser.email);

      if(!twoFactorToken){
        return { error:"Invalid code!" };
      }

      if(twoFactorToken.token !== code) {
        return { error:"Invalid code!" };
      }

      const hasExpired = new Date(twoFactorToken.expires) < new Date();

      if(hasExpired){
        return { error:"Code expired!"};
      }

      await prisma.twoFactorToken.delete({
        where: { id:twoFactorToken.id }
      });

      const existingConfirmation = await getTwoFactorConfirmationByUserId(existingUser.id);

      if(existingConfirmation){
        await prisma.twoFactorConfirmation.delete({
          where: { id: existingConfirmation.id }
        })
      }

      await prisma.twoFactorConfirmation.create({
        data:{
          userId:existingUser.id
        }
      })
    }else {
      const twoFactorToken = await generateTwoFactorToken(existingUser.email);
      await sendTwoFactorTokenEmail(twoFactorToken.email,twoFactorToken.token);

      return { twoFactor: true }
    }
  }
 
  try {
    await signIn("credentials",{
      email,
      password,
      redirect: true,
      redirectTo:callbackUrl || "/"
    })
    
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { error: "Invalid credentials!"}
        default:
          return { error: "Something went wrong!"}
      }
    }
    throw error;
  }
  
}