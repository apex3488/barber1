import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { Services } from "@/components/Services";
import { Barbers } from "@/components/Barbers";
import { Reviews } from "@/components/Reviews";
import { Contacts } from "@/components/Contacts";
import { CtaBanner } from "@/components/CtaBanner";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Services />
        <Barbers />
        <Reviews />
        <Contacts />
        <CtaBanner />
      </main>
      <Footer />
    </>
  );
}
