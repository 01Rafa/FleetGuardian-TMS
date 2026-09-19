import { createContext, useContext, useState } from 'react'

const Ctx = createContext({ weightUnit: 'lb', changeWeightUnit: () => {} })

const UNITS = ['lb', 'ton']

export function WeightUnitProvider({ children }) {
  const [weightUnit, setWeightUnit] = useState(() => {
    const stored = localStorage.getItem('weightUnit')
    return UNITS.includes(stored) ? stored : 'lb'
  })
  const changeWeightUnit = (u) => {
    localStorage.setItem('weightUnit', u)
    setWeightUnit(u)
  }
  return <Ctx.Provider value={{ weightUnit, changeWeightUnit }}>{children}</Ctx.Provider>
}

export const useWeightUnit = () => useContext(Ctx)
