import { createContext, useContext, useState } from 'react'

const Ctx = createContext({ unit: 'mi', changeUnit: () => {} })

export function DistanceUnitProvider({ children }) {
  const [unit, setUnit] = useState(() => localStorage.getItem('distanceUnit') ?? 'mi')
  const changeUnit = (u) => {
    localStorage.setItem('distanceUnit', u)
    setUnit(u)
  }
  return <Ctx.Provider value={{ unit, changeUnit }}>{children}</Ctx.Provider>
}

export const useDistanceUnit = () => useContext(Ctx)
