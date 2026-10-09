import { ManageBooking } from "@/components/booking/ManageBooking";

type Props = {
  params: Promise<{ token: string }>;
};

export default async function BookingManagePage({ params }: Props) {
  const { token } = await params;
  return (
    <main>
      <ManageBooking token={token} />
    </main>
  );
}
