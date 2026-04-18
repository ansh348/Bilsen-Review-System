import { redirect } from "next/navigation";

export default function ReviewsIndexPage() {
  redirect("/reviews/mine");
}
