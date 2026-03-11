import { useEffect, useRef, useState, type FormEvent } from 'react'
import { dataService } from '@shared/services/dataService'
import { useERPData } from '@shared/store/appStore'
import { Page, PageHeader } from '@ui/components'
import QuickNotice from '@shared/components/QuickNotice'
import type { CompanyProfile } from '@shared/types/erp'
import { useCEP } from '../../../../src/hooks/useCEP'

const formatCep = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 5) {
    return digits
  }
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

const Empresa = () => {
  const { data, refresh } = useERPData()
  const [status, setStatus] = useState<string | null>(null)
  const [form, setForm] = useState<CompanyProfile>(() => ({ ...data.empresa }))
  const [isDirty, setIsDirty] = useState(false)
  const { buscarCEP, loading: cepLoading, error: cepError } = useCEP()
  const numberInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (isDirty) {
      return
    }
    setForm({ ...data.empresa })
  }, [data.empresa, isDirty])

  const updateForm = (patch: Partial<CompanyProfile>) => {
    setForm((prev) => ({ ...prev, ...patch }))
    setIsDirty(true)
  }

  const handleZipChange = (value: string) => {
    updateForm({ zip: formatCep(value) })
  }

  const handleZipBlur = async () => {
    const currentZip = form.zip?.trim() ?? ''
    if (!currentZip) {
      return
    }
    const result = await buscarCEP(currentZip)
    if (!result) {
      return
    }

    const complemento = result.complemento.trim()
    const patch: Partial<CompanyProfile> = {
      zip: formatCep(result.cep || currentZip),
      street: result.logradouro,
      neighborhood: result.bairro,
      city: result.localidade,
      state: result.uf,
    }
    if (complemento) {
      patch.complement = complemento
    }
    updateForm(patch)
    requestAnimationFrame(() => {
      numberInputRef.current?.focus()
    })
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.name.trim()) {
      setStatus('Informe o nome da empresa.')
      return
    }

    const payload = dataService.getAll()
    payload.empresa = {
      name: form.name.trim(),
      tradeName: form.tradeName?.trim() || undefined,
      document: form.document?.trim() || undefined,
      stateRegistration: form.stateRegistration?.trim() || undefined,
      email: form.email?.trim() || undefined,
      phone: form.phone?.trim() || undefined,
      street: form.street?.trim() || undefined,
      number: form.number?.trim() || undefined,
      complement: form.complement?.trim() || undefined,
      neighborhood: form.neighborhood?.trim() || undefined,
      city: form.city?.trim() || undefined,
      state: form.state?.trim() || undefined,
      zip: form.zip?.trim() || undefined,
      website: form.website?.trim() || undefined,
      notes: form.notes?.trim() || undefined,
    }
    setIsDirty(false)
    dataService.replaceAll(payload)
    refresh()
    setStatus('Dados da empresa atualizados.')
  }

  return (
    <Page className="empresa">
      <PageHeader />
      <QuickNotice message={status} onClear={() => setStatus(null)} />

      <section className="panel">
        <div className="panel__header">
          <div>
            <h2>Cadastro completo</h2>
            <p>Revise CNPJ, enderecos e contatos da empresa.</p>
          </div>
        </div>

        <form className="form" onSubmit={handleSubmit}>
            <div className="form__group">
              <label className="form__label" htmlFor="company-name">
                Razao social
              </label>
              <input
                id="company-name"
                className="form__input"
                type="text"
                value={form.name}
                onChange={(event) => updateForm({ name: event.target.value })}
                placeholder="Nome juridico da empresa"
              />
            </div>

            <div className="form__group">
              <label className="form__label" htmlFor="company-trade">
                Nome fantasia
              </label>
              <input
                id="company-trade"
                className="form__input"
                type="text"
                value={form.tradeName ?? ''}
                onChange={(event) => updateForm({ tradeName: event.target.value })}
                placeholder="Nome comercial"
              />
            </div>

            <div className="form__row">
              <div className="form__group">
                <label className="form__label" htmlFor="company-document">
                  CNPJ/CPF
                </label>
                <input
                  id="company-document"
                  className="form__input"
                  type="text"
                  value={form.document ?? ''}
                  onChange={(event) => updateForm({ document: event.target.value })}
                  placeholder="Documento oficial"
                />
              </div>
              <div className="form__group">
                <label className="form__label" htmlFor="company-state-reg">
                  Inscricao estadual
                </label>
                <input
                  id="company-state-reg"
                  className="form__input"
                  type="text"
                  value={form.stateRegistration ?? ''}
                  onChange={(event) => updateForm({ stateRegistration: event.target.value })}
                  placeholder="Opcional"
                />
              </div>
            </div>

            <div className="form__row">
              <div className="form__group">
                <label className="form__label" htmlFor="company-email">
                  Email
                </label>
                <input
                  id="company-email"
                  className="form__input"
                  type="email"
                  value={form.email ?? ''}
                  onChange={(event) => updateForm({ email: event.target.value })}
                  placeholder="contato@empresa.com"
                />
              </div>
              <div className="form__group">
                <label className="form__label" htmlFor="company-phone">
                  Telefone
                </label>
                <input
                  id="company-phone"
                  className="form__input"
                  type="text"
                  value={form.phone ?? ''}
                  onChange={(event) => updateForm({ phone: event.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>

            <div className="form__row">
              <div className="form__group">
                <label className="form__label" htmlFor="company-zip">
                  CEP
                </label>
                <input
                  id="company-zip"
                  className="form__input"
                  type="text"
                  value={form.zip ?? ''}
                  onChange={(event) => handleZipChange(event.target.value)}
                  onBlur={() => void handleZipBlur()}
                  placeholder="00000-000"
                  inputMode="numeric"
                  maxLength={9}
                />
                {cepLoading && <p className="form__status">Buscando CEP...</p>}
                {!cepLoading && cepError && (
                  <p className="form__status form__status--danger">{cepError}</p>
                )}
              </div>
              <div className="form__group">
                <label className="form__label" htmlFor="company-street">
                  Rua / Avenida
                </label>
                <input
                  id="company-street"
                  className="form__input"
                  type="text"
                  value={form.street ?? ''}
                  onChange={(event) => updateForm({ street: event.target.value })}
                  placeholder="Logradouro"
                />
              </div>
            </div>

            <div className="form__row">
              <div className="form__group">
                <label className="form__label" htmlFor="company-number">
                  Numero
                </label>
                <input
                  id="company-number"
                  className="form__input"
                  type="text"
                  value={form.number ?? ''}
                  onChange={(event) => updateForm({ number: event.target.value })}
                  placeholder="Numero"
                  ref={numberInputRef}
                />
              </div>
              <div className="form__group">
                <label className="form__label" htmlFor="company-complement">
                  Complemento
                </label>
                <input
                  id="company-complement"
                  className="form__input"
                  type="text"
                  value={form.complement ?? ''}
                  onChange={(event) => updateForm({ complement: event.target.value })}
                  placeholder="Sala, bloco, andar"
                />
              </div>
              <div className="form__group">
                <label className="form__label" htmlFor="company-neighborhood">
                  Bairro
                </label>
                <input
                  id="company-neighborhood"
                  className="form__input"
                  type="text"
                  value={form.neighborhood ?? ''}
                  onChange={(event) => updateForm({ neighborhood: event.target.value })}
                  placeholder="Bairro"
                />
              </div>
            </div>

            <div className="form__row">
              <div className="form__group">
                <label className="form__label" htmlFor="company-city">
                  Cidade
                </label>
                <input
                  id="company-city"
                  className="form__input"
                  type="text"
                  value={form.city ?? ''}
                  onChange={(event) => updateForm({ city: event.target.value })}
                  placeholder="Cidade"
                />
              </div>
              <div className="form__group">
                <label className="form__label" htmlFor="company-state">
                  Estado
                </label>
                <input
                  id="company-state"
                  className="form__input"
                  type="text"
                  value={form.state ?? ''}
                  onChange={(event) => updateForm({ state: event.target.value })}
                  placeholder="UF"
                />
              </div>
            </div>

            <div className="form__group">
              <label className="form__label" htmlFor="company-website">
                Site
              </label>
              <input
                id="company-website"
                className="form__input"
                type="text"
                value={form.website ?? ''}
                onChange={(event) => updateForm({ website: event.target.value })}
                placeholder="www.suaempresa.com"
              />
            </div>

            <div className="form__group">
              <label className="form__label" htmlFor="company-notes">
                Observacoes
              </label>
              <textarea
                id="company-notes"
                className="form__input form__textarea"
                value={form.notes ?? ''}
                onChange={(event) => updateForm({ notes: event.target.value })}
                placeholder="Informacoes adicionais"
              />
            </div>

            <div className="form__actions">
              <button className="button button--primary" type="submit">
                Salvar informacoes
              </button>
            </div>
        </form>
      </section>
    </Page>
  )
}

export default Empresa
