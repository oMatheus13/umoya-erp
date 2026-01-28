import { useEffect, useState, type FormEvent } from 'react'
import { dataService } from '../services/dataService'
import { useERPData } from '../store/appStore'
import type { CompanyProfile } from '../types/erp'

const Empresa = () => {
  const { data, refresh } = useERPData()
  const [status, setStatus] = useState<string | null>(null)
  const [form, setForm] = useState<CompanyProfile>(() => ({ ...data.empresa }))

  useEffect(() => {
    setForm({ ...data.empresa })
  }, [data.empresa])

  const updateForm = (patch: Partial<CompanyProfile>) => {
    setForm((prev) => ({ ...prev, ...patch }))
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
      neighborhood: form.neighborhood?.trim() || undefined,
      city: form.city?.trim() || undefined,
      state: form.state?.trim() || undefined,
      zip: form.zip?.trim() || undefined,
      website: form.website?.trim() || undefined,
      notes: form.notes?.trim() || undefined,
    }
    dataService.replaceAll(payload)
    refresh()
    setStatus('Dados da empresa atualizados.')
  }

  return (
    <section className="empresa">
      <header className="empresa__header">
        <div className="empresa__headline">
          <span className="empresa__eyebrow">Configuracoes</span>
          <h1 className="empresa__title">Dados da empresa</h1>
          <p className="empresa__subtitle">
            Informacoes usadas em impressos, contratos e comunicacao oficial.
          </p>
        </div>
      </header>
      {status && <p className="form__status">{status}</p>}

      <div className="empresa__layout">
        <section className="empresa__panel">
          <div className="empresa__panel-header">
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
                  onChange={(event) => updateForm({ zip: event.target.value })}
                  placeholder="00000-000"
                />
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
      </div>
    </section>
  )
}

export default Empresa
