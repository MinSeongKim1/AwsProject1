import React, { Component, Fragment } from 'react';

import { BrowserRouter as Router, Route, Routes, Link } from "react-router-dom"




import '../node_modules/bootstrap/dist/css/bootstrap.min.css'
import ImageRecognition from './components/pages/ImageRecognition'


class App extends Component {
  constructor(props) {
    super(props)
    this.state = {}
  }
  componentDidMount() { }

  render() {
    return (
      <Fragment>
        <Router>
          <div className="App">
            <nav className="navbar navbar-expand-lg navbar-light fixed-top">
              <div className="container">
                <Link className="navbar-brand" to={'/'}>
                  Demo-Image-Recognition
                </Link>
                <div className="collapse navbar-collapse" id="navbarTogglerDemo02">
                  <ul className="navbar-nav ml-auto">



                  </ul>
                </div>
              </div>
            </nav>
            <div className="auth-wrapper" style={{ marginTop: 100 }} >
              <div className="auth-inner" >
                <Routes>

                  <Route path="/" element={<ImageRecognition />} />

                </Routes>
              </div>
            </div>
          </div>
        </Router>
      </Fragment>
    );
  }
}

export default App;
