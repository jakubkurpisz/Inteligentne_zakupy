import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Package, Plus, Trash2, Edit2, ChevronDown, ChevronUp, Save, X, AlertTriangle, CheckCircle, ShoppingCart, Clock, Search, Filter, Ban, RotateCcw } from 'lucide-react'
import { API_BASE_URL } from '../config/api'
import Toast from '../components/Toast'
import { useResizableColumns } from '../hooks/useResizableColumns'

// Komponent MultiSelect - pozwala wybrać wiele wartości z listy
function MultiSelect({ options, selected, onChange, placeholder, label }) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef(null)

  // Zamknij dropdown po kliknięciu poza komponentem
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Parsuj selected - może być string (JSON lub przecinki) lub array
  const parseSelected = (value) => {
    if (!value) return []
    if (Array.isArray(value)) return value
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : [value]
    } catch {
      return value.split(',').map(s => s.trim()).filter(Boolean)
    }
  }

  const selectedArray = parseSelected(selected)

  const filteredOptions = options?.filter(opt =>
    opt?.toLowerCase().includes(search.toLowerCase()) &&
    !selectedArray.includes(opt)
  ) || []

  const handleSelect = (option) => {
    const newSelected = [...selectedArray, option]
    onChange(newSelected)
    setSearch('')
  }

  const handleRemove = (option) => {
    const newSelected = selectedArray.filter(s => s !== option)
    onChange(newSelected)
  }

  return (
    <div ref={containerRef} className="relative">
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}

      {/* Wybrane wartości */}
      <div
        className="min-h-[42px] w-full px-3 py-2 border rounded-lg focus-within:ring-2 focus-within:ring-blue-500 bg-white cursor-text flex flex-wrap gap-1"
        onClick={() => setIsOpen(true)}
      >
        {selectedArray.map(item => (
          <span
            key={item}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-sm"
          >
            {item}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleRemove(item); }}
              className="hover:text-blue-600"
            >
              <X size={14} />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder={selectedArray.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[100px] outline-none text-sm"
        />
      </div>

      {/* Dropdown z opcjami */}
      {isOpen && filteredOptions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filteredOptions.slice(0, 50).map(option => (
            <button
              key={option}
              type="button"
              onClick={() => handleSelect(option)}
              className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 border-b border-gray-100 last:border-0"
            >
              {option}
            </button>
          ))}
          {filteredOptions.length > 50 && (
            <div className="px-3 py-2 text-sm text-gray-500 text-center">
              ... i {filteredOptions.length - 50} więcej (wpisz aby zawęzić)
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Osobny komponent formularza - zapobiega re-renderowaniu przy wpisywaniu
function GroupForm({ initialData, filterOptions: initialFilterOptions, onSubmit, onCancel, isEditing }) {
  const [localForm, setLocalForm] = useState(initialData)
  const [showExclusions, setShowExclusions] = useState(false)
  const [dynamicOptions, setDynamicOptions] = useState(initialFilterOptions)
  const [loadingOptions, setLoadingOptions] = useState(false)

  // Sprawdź czy są jakieś wykluczenia
  useEffect(() => {
    const hasExclusions = Object.keys(localForm).some(key =>
      key.startsWith('exclude_') && localForm[key] &&
      (Array.isArray(localForm[key]) ? localForm[key].length > 0 : localForm[key].length > 0)
    )
    if (hasExclusions) setShowExclusions(true)
  }, [])

  // Pobierz dynamiczne opcje na podstawie wybranych filtrów
  const fetchDynamicOptions = useCallback(async (currentFilters) => {
    // Sprawdź czy są jakieś wybrane filtry
    const hasFilters = Object.keys(currentFilters).some(key =>
      key.startsWith('filter_') &&
      currentFilters[key] &&
      (Array.isArray(currentFilters[key]) ? currentFilters[key].length > 0 : currentFilters[key].length > 0)
    )

    if (!hasFilters) {
      // Brak filtrów - użyj początkowych opcji
      setDynamicOptions(initialFilterOptions)
      return
    }

    setLoadingOptions(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/minimal-stocks/filter-options-dynamic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentFilters)
      })
      const data = await response.json()
      if (data.success) {
        setDynamicOptions(data.data)
      }
    } catch (err) {
      console.error('Błąd pobierania dynamicznych opcji:', err)
    } finally {
      setLoadingOptions(false)
    }
  }, [initialFilterOptions])

  // Debounce - pobierz opcje po 300ms od ostatniej zmiany
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDynamicOptions(localForm)
    }, 300)
    return () => clearTimeout(timer)
  }, [localForm.filter_rodzaj, localForm.filter_marka, localForm.filter_rozmiar,
      localForm.filter_kolor, localForm.filter_model, localForm.filter_plec,
      localForm.filter_sezon, localForm.filter_przeznaczenie, fetchDynamicOptions])

  const handleChange = (field, value) => {
    setLocalForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = () => {
    onSubmit(localForm)
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-4 border-2 border-blue-200">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        {isEditing ? <Edit2 size={20} /> : <Plus size={20} />}
        {isEditing ? 'Edytuj grupę' : 'Nowa grupa stanów minimalnych'}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Nazwa grupy */}
        <div className="col-span-full md:col-span-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Nazwa grupy</label>
          <input
            type="text"
            value={localForm.name}
            onChange={e => handleChange('name', e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="np. Klapki AD czarne 36"
          />
        </div>

        {/* Stan minimalny */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Stan minimalny</label>
          <input
            type="number"
            value={localForm.min_stock}
            onChange={e => handleChange('min_stock', parseInt(e.target.value) || 0)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            min="0"
          />
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            value={localForm.status}
            onChange={e => handleChange('status', e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="active">Aktywny</option>
            <option value="ordered">Zamówiony</option>
            <option value="unavailable">Brak w hurtowni</option>
            <option value="inactive">Nieaktywny</option>
          </select>
        </div>

        {/* SEKCJA: FILTRY WŁĄCZAJĄCE */}
        <div className="col-span-full border-t pt-4 mt-2">
          <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
            <Filter size={16} className="text-green-600" />
            Warunki (produkty ZAWIERAJĄCE wybrane wartości)
            {loadingOptions && (
              <span className="ml-2 text-xs text-blue-600 flex items-center gap-1">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                Aktualizuję opcje...
              </span>
            )}
          </h4>
          <p className="text-xs text-gray-500 mb-3">
            Możesz wybrać wiele wartości - produkt musi pasować do PRZYNAJMNIEJ JEDNEJ z wybranych wartości w każdym polu.
            <span className="text-blue-600 font-medium"> Listy zawężają się automatycznie po wyborze parametrów.</span>
          </p>
        </div>

        {/* Rodzaj */}
        <div>
          <MultiSelect
            label="Rodzaj"
            options={dynamicOptions.rodzaj}
            selected={localForm.filter_rodzaj}
            onChange={val => handleChange('filter_rodzaj', val)}
            placeholder="np. KLAPKI, SANDAŁY"
          />
        </div>

        {/* Marka */}
        <div>
          <MultiSelect
            label="Marka"
            options={dynamicOptions.marka}
            selected={localForm.filter_marka}
            onChange={val => handleChange('filter_marka', val)}
            placeholder="np. AD, RIDER"
          />
        </div>

        {/* Rozmiar */}
        <div>
          <MultiSelect
            label="Rozmiar"
            options={dynamicOptions.rozmiar}
            selected={localForm.filter_rozmiar}
            onChange={val => handleChange('filter_rozmiar', val)}
            placeholder="np. 36, 37, 38"
          />
        </div>

        {/* Kolor */}
        <div>
          <MultiSelect
            label="Kolor"
            options={dynamicOptions.kolor}
            selected={localForm.filter_kolor}
            onChange={val => handleChange('filter_kolor', val)}
            placeholder="np. CZARNY, BIAŁY"
          />
        </div>

        {/* Model */}
        <div>
          <MultiSelect
            label="Model"
            options={dynamicOptions.model}
            selected={localForm.filter_model}
            onChange={val => handleChange('filter_model', val)}
            placeholder="np. ADILETTE"
          />
        </div>

        {/* Płeć */}
        <div>
          <MultiSelect
            label="Płeć"
            options={dynamicOptions.plec}
            selected={localForm.filter_plec}
            onChange={val => handleChange('filter_plec', val)}
            placeholder="np. DAMSKIE, MĘSKIE"
          />
        </div>

        {/* Sezon */}
        <div>
          <MultiSelect
            label="Sezon"
            options={dynamicOptions.sezon}
            selected={localForm.filter_sezon}
            onChange={val => handleChange('filter_sezon', val)}
            placeholder="np. WL24, JZ25"
          />
          <div className="mt-1 text-xs text-gray-500 bg-gray-50 p-2 rounded">
            <span className="font-medium">Legenda:</span>{' '}
            <span className="text-blue-600">WL</span>=Wiosna/Lato, {' '}
            <span className="text-orange-600">JZ</span>=Jesień/Zima, {' '}
            <span className="text-gray-600">24/25</span>=rok (np. WL24 = Wiosna/Lato 2024)
          </div>
        </div>

        {/* Przeznaczenie */}
        <div>
          <MultiSelect
            label="Przeznaczenie"
            options={dynamicOptions.przeznaczenie}
            selected={localForm.filter_przeznaczenie}
            onChange={val => handleChange('filter_przeznaczenie', val)}
            placeholder="np. BIEGANIE, PŁYWANIE"
          />
        </div>

        {/* Nazwa (zawiera) - tekst */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nazwa zawiera</label>
          <input
            type="text"
            value={localForm.filter_nazwa || ''}
            onChange={e => handleChange('filter_nazwa', e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="np. FOOTBALL"
          />
        </div>

        {/* Uwagi (zawiera) - tekst */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Uwagi zawiera</label>
          <input
            type="text"
            value={localForm.filter_uwagi || ''}
            onChange={e => handleChange('filter_uwagi', e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="np. WYPRZEDAŻ"
          />
        </div>

        {/* SEKCJA: WYKLUCZENIA */}
        <div className="col-span-full border-t pt-4 mt-2">
          <button
            type="button"
            onClick={() => setShowExclusions(!showExclusions)}
            className="font-medium text-gray-700 flex items-center gap-2 hover:text-red-600"
          >
            <Ban size={16} className="text-red-600" />
            Wykluczenia (produkty NIE zawierające wybranych wartości)
            <ChevronDown size={16} className={`transform transition-transform ${showExclusions ? 'rotate-180' : ''}`} />
          </button>
          {!showExclusions && (
            <p className="text-xs text-gray-500 mt-1">
              Kliknij aby rozwinąć sekcję wykluczeń
            </p>
          )}
        </div>

        {showExclusions && (
          <>
            <div className="col-span-full">
              <p className="text-xs text-gray-500 mb-3">
                Produkty zawierające KTÓRĄKOLWIEK z wybranych wartości zostaną wykluczone z grupy
              </p>
            </div>

            {/* Wyklucz Rodzaj */}
            <div>
              <MultiSelect
                label="Wyklucz Rodzaj"
                options={dynamicOptions.rodzaj}
                selected={localForm.exclude_rodzaj}
                onChange={val => handleChange('exclude_rodzaj', val)}
                placeholder="np. BUTY"
              />
            </div>

            {/* Wyklucz Marka */}
            <div>
              <MultiSelect
                label="Wyklucz Marka"
                options={dynamicOptions.marka}
                selected={localForm.exclude_marka}
                onChange={val => handleChange('exclude_marka', val)}
                placeholder="np. INNE"
              />
            </div>

            {/* Wyklucz Rozmiar */}
            <div>
              <MultiSelect
                label="Wyklucz Rozmiar"
                options={dynamicOptions.rozmiar}
                selected={localForm.exclude_rozmiar}
                onChange={val => handleChange('exclude_rozmiar', val)}
                placeholder="np. XL, XXL"
              />
            </div>

            {/* Wyklucz Kolor */}
            <div>
              <MultiSelect
                label="Wyklucz Kolor"
                options={dynamicOptions.kolor}
                selected={localForm.exclude_kolor}
                onChange={val => handleChange('exclude_kolor', val)}
                placeholder="np. RÓŻOWY"
              />
            </div>

            {/* Wyklucz Model */}
            <div>
              <MultiSelect
                label="Wyklucz Model"
                options={dynamicOptions.model}
                selected={localForm.exclude_model}
                onChange={val => handleChange('exclude_model', val)}
                placeholder="np. OLD MODEL"
              />
            </div>

            {/* Wyklucz Płeć */}
            <div>
              <MultiSelect
                label="Wyklucz Płeć"
                options={dynamicOptions.plec}
                selected={localForm.exclude_plec}
                onChange={val => handleChange('exclude_plec', val)}
                placeholder="np. KIDS"
              />
            </div>

            {/* Wyklucz Sezon */}
            <div>
              <MultiSelect
                label="Wyklucz Sezon"
                options={dynamicOptions.sezon}
                selected={localForm.exclude_sezon}
                onChange={val => handleChange('exclude_sezon', val)}
                placeholder="np. WL20"
              />
              <div className="mt-1 text-xs text-gray-500 bg-gray-50 p-2 rounded">
                <span className="font-medium">Legenda:</span>{' '}
                <span className="text-blue-600">WL</span>=Wiosna/Lato, {' '}
                <span className="text-orange-600">JZ</span>=Jesień/Zima, {' '}
                <span className="text-gray-600">24/25</span>=rok
              </div>
            </div>

            {/* Wyklucz Przeznaczenie */}
            <div>
              <MultiSelect
                label="Wyklucz Przeznaczenie"
                options={dynamicOptions.przeznaczenie}
                selected={localForm.exclude_przeznaczenie}
                onChange={val => handleChange('exclude_przeznaczenie', val)}
                placeholder="np. SUPLEMENTY"
              />
            </div>

            {/* Wyklucz Nazwa (zawiera) - tekst */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Wyklucz nazwę zawierającą</label>
              <input
                type="text"
                value={localForm.exclude_nazwa || ''}
                onChange={e => handleChange('exclude_nazwa', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="np. OUTLET"
              />
            </div>

            {/* Wyklucz Uwagi (zawiera) - tekst */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Wyklucz uwagi zawierające</label>
              <input
                type="text"
                value={localForm.exclude_uwagi || ''}
                onChange={e => handleChange('exclude_uwagi', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="np. WYCOFANY"
              />
            </div>
          </>
        )}
      </div>

      <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-2"
        >
          <X size={18} />
          Anuluj
        </button>
        <button
          onClick={handleSubmit}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Save size={18} />
          {isEditing ? 'Zapisz zmiany' : 'Dodaj grupę'}
        </button>
      </div>
    </div>
  )
}

function MinimalStocks() {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedGroups, setExpandedGroups] = useState({})
  const [editingGroup, setEditingGroup] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [filterOptions, setFilterOptions] = useState({})
  const [toast, setToast] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')

  // Resizable columns dla tabeli produktów
  const { getColumnStyle, ResizeHandle, resetWidths } = useResizableColumns({
    symbol: 100,
    nazwa: 200,
    marka: 80,
    rozmiar: 70,
    kolor: 80,
    stan: 60,
    propMin: 70,
    srTyg: 60,
    cena: 80
  }, 'minimalStocks_columns', 50)

  const emptyFormData = {
    name: '',
    min_stock: 0,
    status: 'active',
    filter_rozmiar: [],
    filter_marka: [],
    filter_model: [],
    filter_plec: [],
    filter_rodzaj: [],
    filter_uwagi: '',
    filter_opis: '',
    filter_kolor: [],
    filter_sezon: [],
    filter_nazwa: '',
    filter_przeznaczenie: [],
    exclude_rozmiar: [],
    exclude_marka: [],
    exclude_model: [],
    exclude_plec: [],
    exclude_rodzaj: [],
    exclude_uwagi: '',
    exclude_opis: '',
    exclude_kolor: [],
    exclude_sezon: [],
    exclude_nazwa: '',
    exclude_przeznaczenie: []
  }

  // Pobierz grupy
  const fetchGroups = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_BASE_URL}/api/minimal-stocks`)
      const data = await response.json()
      if (data.success) {
        setGroups(data.data)
      } else {
        throw new Error(data.detail || 'Błąd pobierania danych')
      }
    } catch (err) {
      setError(err.message)
      setToast({ type: 'error', message: err.message })
    } finally {
      setLoading(false)
    }
  }

  // Pobierz opcje filtrów
  const fetchFilterOptions = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/minimal-stocks/filter-options`)
      const data = await response.json()
      if (data.success) {
        setFilterOptions(data.data)
      }
    } catch (err) {
      console.error('Błąd pobierania opcji filtrów:', err)
    }
  }

  // Pobierz szczegóły grupy (z produktami i danymi sezonowości)
  const fetchGroupDetails = async (groupId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/minimal-stocks/${groupId}`)
      const data = await response.json()
      if (data.success) {
        const products = data.data.products || []

        // Pobierz dane sezonowości dla produktów w grupie
        if (products.length > 0) {
          const symbols = products.map(p => p.Symbol)
          try {
            const seasonalityResponse = await fetch(`${API_BASE_URL}/api/suggested-min-stocks`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                symbols,
                stock_weeks: 1,
                delivery_weeks: 1
              })
            })
            const seasonalityData = await seasonalityResponse.json()
            if (seasonalityData.success) {
              // Dołącz dane sezonowości do produktów
              const productsWithSeasonality = products.map(p => ({
                ...p,
                seasonality: seasonalityData.data[p.Symbol] || null
              }))

              // Oblicz sumę proponowanych stanów minimalnych
              const suggestedMinTotal = productsWithSeasonality.reduce((sum, p) =>
                sum + (p.seasonality?.proponowany_min || 0), 0)

              setGroups(prev => prev.map(g =>
                g.id === groupId ? {
                  ...g,
                  products: productsWithSeasonality,
                  suggested_min_total: suggestedMinTotal
                } : g
              ))
              return
            }
          } catch (seasonErr) {
            console.error('Błąd pobierania danych sezonowości:', seasonErr)
          }
        }

        // Fallback bez danych sezonowości
        setGroups(prev => prev.map(g =>
          g.id === groupId ? { ...g, products } : g
        ))
      }
    } catch (err) {
      console.error('Błąd pobierania szczegółów grupy:', err)
    }
  }

  useEffect(() => {
    fetchGroups()
    fetchFilterOptions()
  }, [])

  // Rozwiń/zwiń grupę
  const toggleExpand = async (groupId) => {
    const isExpanding = !expandedGroups[groupId]
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: isExpanding
    }))

    if (isExpanding) {
      const group = groups.find(g => g.id === groupId)
      if (!group?.products) {
        await fetchGroupDetails(groupId)
      }
    }
  }

  // Dodaj nową grupę
  const handleAddGroup = async (formData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/minimal-stocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      const data = await response.json()
      if (data.success) {
        setToast({ type: 'success', message: 'Grupa dodana pomyślnie' })
        setShowAddForm(false)
        fetchGroups()
      } else {
        throw new Error(data.detail || 'Błąd dodawania grupy')
      }
    } catch (err) {
      setToast({ type: 'error', message: err.message })
    }
  }

  // Aktualizuj grupę
  const handleUpdateGroup = async (groupId, formData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/minimal-stocks/${groupId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      const data = await response.json()
      if (data.success) {
        setToast({ type: 'success', message: 'Grupa zaktualizowana' })
        setEditingGroup(null)
        fetchGroups()
      } else {
        throw new Error(data.detail || 'Błąd aktualizacji grupy')
      }
    } catch (err) {
      setToast({ type: 'error', message: err.message })
    }
  }

  // Usuń grupę
  const handleDeleteGroup = async (groupId) => {
    if (!window.confirm('Czy na pewno chcesz usunąć tę grupę?')) return

    try {
      const response = await fetch(`${API_BASE_URL}/api/minimal-stocks/${groupId}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      if (data.success) {
        setToast({ type: 'success', message: 'Grupa usunięta' })
        fetchGroups()
      } else {
        throw new Error(data.detail || 'Błąd usuwania grupy')
      }
    } catch (err) {
      setToast({ type: 'error', message: err.message })
    }
  }

  // Zmień status grupy
  const handleStatusChange = async (groupId, newStatus) => {
    const group = groups.find(g => g.id === groupId)
    if (!group) return

    try {
      const response = await fetch(`${API_BASE_URL}/api/minimal-stocks/${groupId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...group, status: newStatus })
      })
      const data = await response.json()
      if (data.success) {
        setToast({ type: 'success', message: `Status zmieniony na: ${getStatusLabel(newStatus)}` })
        fetchGroups()
      }
    } catch (err) {
      setToast({ type: 'error', message: err.message })
    }
  }

  // Pobierz etykietę statusu
  const getStatusLabel = (status) => {
    const labels = {
      'active': 'Aktywny',
      'ordered': 'Zamówiony',
      'unavailable': 'Brak w hurtowni',
      'inactive': 'Nieaktywny'
    }
    return labels[status] || status
  }

  // Pobierz kolor statusu
  const getStatusColor = (status) => {
    const colors = {
      'active': 'bg-green-100 text-green-800',
      'ordered': 'bg-blue-100 text-blue-800',
      'unavailable': 'bg-orange-100 text-orange-800',
      'inactive': 'bg-gray-100 text-gray-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  // Pobierz kolor różnicy stanu
  const getDifferenceColor = (diff) => {
    if (diff < 0) return 'text-red-600 bg-red-50'
    if (diff === 0) return 'text-yellow-600 bg-yellow-50'
    return 'text-green-600 bg-green-50'
  }

  // Helper do formatowania wartości filtrow (string lub array)
  const formatFilterValue = (value) => {
    if (!value) return null
    if (Array.isArray(value)) return value.join(', ')
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed.join(', ')
    } catch {}
    return value
  }

  // Przygotuj dane do edycji
  const getEditFormData = (group) => ({
    name: group.name || '',
    min_stock: group.min_stock || 0,
    status: group.status || 'active',
    filter_rozmiar: group.filter_rozmiar || [],
    filter_marka: group.filter_marka || [],
    filter_model: group.filter_model || [],
    filter_plec: group.filter_plec || [],
    filter_rodzaj: group.filter_rodzaj || [],
    filter_uwagi: group.filter_uwagi || '',
    filter_opis: group.filter_opis || '',
    filter_kolor: group.filter_kolor || [],
    filter_sezon: group.filter_sezon || [],
    filter_nazwa: group.filter_nazwa || '',
    filter_przeznaczenie: group.filter_przeznaczenie || [],
    exclude_rozmiar: group.exclude_rozmiar || [],
    exclude_marka: group.exclude_marka || [],
    exclude_model: group.exclude_model || [],
    exclude_plec: group.exclude_plec || [],
    exclude_rodzaj: group.exclude_rodzaj || [],
    exclude_uwagi: group.exclude_uwagi || '',
    exclude_opis: group.exclude_opis || '',
    exclude_kolor: group.exclude_kolor || [],
    exclude_sezon: group.exclude_sezon || [],
    exclude_nazwa: group.exclude_nazwa || '',
    exclude_przeznaczenie: group.exclude_przeznaczenie || []
  })

  // Filtruj grupy po wyszukiwaniu
  const filteredGroups = groups.filter(group => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      group.name?.toLowerCase().includes(search) ||
      formatFilterValue(group.filter_marka)?.toLowerCase().includes(search) ||
      formatFilterValue(group.filter_rodzaj)?.toLowerCase().includes(search) ||
      formatFilterValue(group.filter_rozmiar)?.toLowerCase().includes(search)
    )
  })

  if (loading && groups.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      {/* Nagłówek */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="text-blue-600" />
            Stany Minimalne
          </h1>
          <p className="text-gray-600 mt-1">
            Zarządzanie grupami produktów i stanami minimalnymi
          </p>
        </div>

        <div className="flex gap-2">
          {/* Wyszukiwanie */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Szukaj grupy..."
              className="pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={() => {
              setShowAddForm(true)
              setEditingGroup(null)
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus size={18} />
            Nowa grupa
          </button>
        </div>
      </div>

      {/* Statystyki */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Wszystkie grupy</div>
          <div className="text-2xl font-bold text-gray-900">{groups.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Poniżej minimum</div>
          <div className="text-2xl font-bold text-red-600">
            {groups.filter(g => g.stock_difference < 0).length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Zamówione</div>
          <div className="text-2xl font-bold text-blue-600">
            {groups.filter(g => g.status === 'ordered').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Brak w hurtowni</div>
          <div className="text-2xl font-bold text-orange-600">
            {groups.filter(g => g.status === 'unavailable').length}
          </div>
        </div>
      </div>

      {/* Formularz dodawania */}
      {showAddForm && !editingGroup && (
        <GroupForm
          key="add-form"
          initialData={emptyFormData}
          filterOptions={filterOptions}
          onSubmit={handleAddGroup}
          onCancel={() => setShowAddForm(false)}
          isEditing={false}
        />
      )}

      {/* Lista grup */}
      <div className="space-y-2">
        {filteredGroups.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            <Package size={48} className="mx-auto mb-4 text-gray-300" />
            <p>Brak grup stanów minimalnych</p>
            <p className="text-sm mt-2">Kliknij "Nowa grupa" aby dodać pierwszą grupę</p>
          </div>
        ) : (
          filteredGroups.map(group => (
            <div key={group.id} className="bg-white rounded-lg shadow overflow-hidden">
              {/* Nagłówek grupy */}
              {editingGroup === group.id ? (
                <GroupForm
                  key={`edit-form-${group.id}`}
                  initialData={getEditFormData(group)}
                  filterOptions={filterOptions}
                  onSubmit={(formData) => handleUpdateGroup(group.id, formData)}
                  onCancel={() => setEditingGroup(null)}
                  isEditing={true}
                />
              ) : (
                <>
                  <div
                    className="p-4 cursor-pointer hover:bg-gray-50 flex items-center justify-between"
                    onClick={() => toggleExpand(group.id)}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      {/* Ikona rozwijania */}
                      <button className="text-gray-400 hover:text-gray-600">
                        {expandedGroups[group.id] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </button>

                      {/* Nazwa i filtry */}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900">{group.name}</div>
                        <div className="text-sm text-gray-500 flex flex-wrap gap-2 mt-1">
                          {formatFilterValue(group.filter_rodzaj) && (
                            <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded text-xs">
                              Rodzaj: {formatFilterValue(group.filter_rodzaj)}
                            </span>
                          )}
                          {formatFilterValue(group.filter_marka) && (
                            <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded text-xs">
                              Marka: {formatFilterValue(group.filter_marka)}
                            </span>
                          )}
                          {formatFilterValue(group.filter_rozmiar) && (
                            <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded text-xs">
                              Rozmiar: {formatFilterValue(group.filter_rozmiar)}
                            </span>
                          )}
                          {formatFilterValue(group.filter_kolor) && (
                            <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded text-xs">
                              Kolor: {formatFilterValue(group.filter_kolor)}
                            </span>
                          )}
                          {formatFilterValue(group.exclude_rodzaj) && (
                            <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded text-xs">
                              Wyklucz: {formatFilterValue(group.exclude_rodzaj)}
                            </span>
                          )}
                          {formatFilterValue(group.exclude_marka) && (
                            <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded text-xs">
                              Wyklucz: {formatFilterValue(group.exclude_marka)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Statystyki */}
                      <div className="flex items-center gap-6 text-sm">
                        {/* Aktualny stan */}
                        <div className="text-center">
                          <div className="text-gray-500">Aktualny</div>
                          <div className="font-bold text-lg">{group.current_stock}</div>
                        </div>

                        {/* Minimum (ręczne) */}
                        <div className="text-center">
                          <div className="text-gray-500">Minimum</div>
                          <div className="font-bold text-lg">{group.min_stock}</div>
                        </div>

                        {/* Proponowany MIN (z sezonowości) */}
                        {group.suggested_min_total !== undefined && (
                          <div className="text-center bg-purple-50 px-2 py-1 rounded-lg" title="Proponowany stan min. na podstawie sezonowości (zapas 1 tyg. + dostawa 1 tyg.)">
                            <div className="text-purple-600 text-xs">Proponowany</div>
                            <div className="font-bold text-lg text-purple-700">{group.suggested_min_total}</div>
                          </div>
                        )}

                        {/* Różnica */}
                        <div className={`text-center px-3 py-1 rounded-lg ${getDifferenceColor(group.stock_difference)}`}>
                          <div className="text-xs opacity-75">Różnica</div>
                          <div className="font-bold text-lg">
                            {group.stock_difference > 0 ? '+' : ''}{group.stock_difference}
                          </div>
                        </div>

                        {/* Produkty */}
                        <div className="text-center">
                          <div className="text-gray-500">Produktów</div>
                          <div className="font-medium">{group.products_count}</div>
                        </div>
                      </div>

                      {/* Status */}
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(group.status)}`}>
                        {getStatusLabel(group.status)}
                      </span>
                    </div>

                    {/* Akcje */}
                    <div className="flex items-center gap-1 ml-4" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => handleStatusChange(group.id, 'ordered')}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="Zamówione"
                      >
                        <ShoppingCart size={18} />
                      </button>
                      <button
                        onClick={() => handleStatusChange(group.id, 'unavailable')}
                        className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg"
                        title="Brak w hurtowni"
                      >
                        <Clock size={18} />
                      </button>
                      <button
                        onClick={() => setEditingGroup(group.id)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                        title="Edytuj"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDeleteGroup(group.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        title="Usuń"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Rozwinięta lista produktów */}
                  {expandedGroups[group.id] && (
                    <div className="border-t bg-gray-50 p-4">
                      {group.products ? (
                        group.products.length > 0 ? (
                          <div className="overflow-x-auto">
                            <div className="flex justify-end mb-2">
                              <button
                                onClick={resetWidths}
                                className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                                title="Resetuj szerokość kolumn"
                              >
                                <RotateCcw size={12} />
                                Reset kolumn
                              </button>
                            </div>
                            <table className="min-w-full text-sm table-fixed">
                              <thead>
                                <tr className="text-left text-gray-500 border-b">
                                  <th className="pb-2 pr-4 relative" style={getColumnStyle('symbol')}>
                                    Symbol
                                    <ResizeHandle columnKey="symbol" />
                                  </th>
                                  <th className="pb-2 pr-4 relative" style={getColumnStyle('nazwa')}>
                                    Nazwa
                                    <ResizeHandle columnKey="nazwa" />
                                  </th>
                                  <th className="pb-2 pr-4 relative" style={getColumnStyle('marka')}>
                                    Marka
                                    <ResizeHandle columnKey="marka" />
                                  </th>
                                  <th className="pb-2 pr-4 relative" style={getColumnStyle('rozmiar')}>
                                    Rozmiar
                                    <ResizeHandle columnKey="rozmiar" />
                                  </th>
                                  <th className="pb-2 pr-4 relative" style={getColumnStyle('kolor')}>
                                    Kolor
                                    <ResizeHandle columnKey="kolor" />
                                  </th>
                                  <th className="pb-2 pr-4 text-right relative" style={getColumnStyle('stan')}>
                                    Stan
                                    <ResizeHandle columnKey="stan" />
                                  </th>
                                  <th className="pb-2 pr-4 text-right text-purple-600 relative" style={getColumnStyle('propMin')} title="Proponowany stan minimalny z analizy sezonowości">
                                    Prop. MIN
                                    <ResizeHandle columnKey="propMin" />
                                  </th>
                                  <th className="pb-2 pr-4 text-right text-gray-500 relative" style={getColumnStyle('srTyg')} title="Średnia tygodniowa sprzedaż">
                                    Śr. tyg.
                                    <ResizeHandle columnKey="srTyg" />
                                  </th>
                                  <th className="pb-2 text-right relative" style={getColumnStyle('cena')}>
                                    Cena
                                    <ResizeHandle columnKey="cena" />
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {group.products.map(product => {
                                  const suggestedMin = product.seasonality?.proponowany_min || 0
                                  const avgWeekly = product.seasonality?.srednia_tygodniowa || 0
                                  const needsRestock = suggestedMin > (product.Stan || 0)

                                  return (
                                    <tr key={product.Symbol} className={`border-b border-gray-100 hover:bg-white ${needsRestock ? 'bg-orange-50/50' : ''}`}>
                                      <td className="py-2 pr-4 font-mono text-xs">{product.Symbol}</td>
                                      <td className="py-2 pr-4 max-w-xs truncate">{product.Nazwa}</td>
                                      <td className="py-2 pr-4">{product.Marka}</td>
                                      <td className="py-2 pr-4">{product.Rozmiar}</td>
                                      <td className="py-2 pr-4">{product.Kolor}</td>
                                      <td className="py-2 pr-4 text-right font-medium">{product.Stan}</td>
                                      <td className={`py-2 pr-4 text-right font-medium ${needsRestock ? 'text-orange-600' : 'text-purple-600'}`}>
                                        {suggestedMin > 0 ? suggestedMin : '-'}
                                      </td>
                                      <td className="py-2 pr-4 text-right text-gray-500 text-xs">
                                        {avgWeekly > 0 ? avgWeekly.toFixed(1) : '-'}
                                      </td>
                                      <td className="py-2 text-right">{product.DetalicznaBrutto?.toFixed(2)} zł</td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                              <tfoot>
                                <tr className="font-semibold bg-gray-100">
                                  <td colSpan="5" className="py-2 pr-4">SUMA</td>
                                  <td className="py-2 pr-4 text-right">{group.current_stock}</td>
                                  <td className="py-2 pr-4 text-right text-purple-700">
                                    {group.suggested_min_total || '-'}
                                  </td>
                                  <td className="py-2 pr-4 text-right text-gray-500">
                                    {group.products.reduce((sum, p) => sum + (p.seasonality?.srednia_tygodniowa || 0), 0).toFixed(1)}
                                  </td>
                                  <td className="py-2 text-right">
                                    {group.products.reduce((sum, p) => sum + (p.DetalicznaBrutto || 0) * (p.Stan || 0), 0).toFixed(2)} zł
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        ) : (
                          <p className="text-gray-500 text-center py-4">
                            Brak produktów pasujących do filtrów
                          </p>
                        )
                      ) : (
                        <div className="flex items-center justify-center py-4">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                          <span className="ml-2 text-gray-500">Ładowanie produktów...</span>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default MinimalStocks
