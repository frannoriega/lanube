import { UserContext } from "@/components/providers/user";
import { useContext } from "react";

export default function useUser() {
  const user = useContext(UserContext);
  return user;
}
