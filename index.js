
const functions = require('firebase-functions');
const express = require("express");
const session =require('express-session')
const FirebaseStore = require('connect-session-firebase')(session);
const FirestoreStore = require( 'firestore-store' )(session);
var cookieParser = require('cookie-parser')
const bodyParser = require("body-parser");
const admin = require("firebase-admin");
const serviceAccount = require("K:/khara/node/serviceAccountKey.json");
const crypto=require('crypto');


var app = express();
const ref= admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://yadawy-test.firebaseio.com"
  });
  const db= admin.firestore();

app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
//render css files
app.use(express.static("public"));
app // or connect
  .use( session( {
    store:  new FirestoreStore( {
      database: db
    } ),

    secret:            'keyboard cat',
    resave:            false,
    saveUninitialized: false,
    rolling: true
  } ) );


//post route for veryfing tokens and sending user from the client to the server
/*app.post("/tokensignin",function(req,res){
var token = req.body.idtoken;
admin.auth().verifyIdToken(idToken)
  .then(function(decodedToken) {
    var uid = decodedToken.uid;
   const user= admin.auth().getUser(uid);
   console.log(user);
  }).catch(function(error) {
    console.log(error);
  });

});
*/

//post route for logining from the firestore
app.post("/login", function (req,res){
var username=req.body.username;
var password=req.body.password;
//hashing the password with the crypto library
var password_digest=crypto.createHash('sha256').update(password).digest('hex');
password_digest=password_digest.toUpperCase();

var usersref= db.collection("users")
var user=usersref.where("username","==",username).where("password_digest","==",password_digest).get()
            .then(snapshot => {
              req.session.userId= snapshot.docs[0].id;
              req.session.username=snapshot.docs[0].data().username;
              req.session.save();
              
              res.redirect("/home");
             
            })
            .catch(err => {
                res.redirect("/login");
                
            });

});
//get route for the home page 
app.get('/',function (req,res){
    if(req.session.userId){
        res.redirect('/logged');
    }else{
        res.render('signin');
    }
});
//get route for logging in check
app.get('/logged',function(req,res){
    console.log(req.session);
if(req.session.userId){
    res.write("<h1> User logged In </h1> <a href='/logout'> Logout </a> ")
}else{
    res.write("<h1>User Not logged In </h1> <a href='/'>Main Page</a>")
}

});
//home page to choose actions from
app.get("/home", function(req,res){
res.render("home");
    
});
app.get('/logout',function(req,res){
    req.session.destroy(function(err){
        if(err){
            res.negotiate(err);
        }
        res.redirect('/');
    });
});
//post route for adding new task 


//post route for creating a new list
app.post("/newlist",function(req,res){

    var addDoc = db.collection("TaskList").add({
        CategoryId: req.body.category,
        ListName: req.body.listname,
        userId: req.session.userId
      }).then(ref => {
        console.log('Added document with ID: ', ref.id);
      });
      
   
});
//post route for creating a new category
app.post("/newcategory",function(req,res){
    
    var addDoc = db.collection("Category").add({
        CategoryName: req.body.category,
        
      }).then(ref => {
        console.log('Added document with ID: ', ref.id);
      });
});

//get route for login page
app.get("/login",function(req,res){
res.render("signin")
});

//get route for creating a new category page
app.get("/newcategory",function(req,res){
    res.render("newcategory");
});

//get route for creating a new list page
app.get("/newlist",function(req,res){
    var categories=[];
    db.collection("Category").get()
    .then(snapshot=>{
        snapshot.forEach(doc=>{
            categories.push({data:doc.data().CategoryName, id:doc.id});
          
            
        });
        //passing the categories to the new list page so that the user can choose from
        res.render("newlist",{categories: categories});
    })
    .catch(err=>{
        console.log('Error Getting Documents',err);
    });
    
    
});
//get route for list index page
app.get("/lists",function(req,res){
    var categories=[];
    db.collection("Category").get()
    .then(snapshot=>{
        snapshot.forEach(doc=>{
            categories.push({data:doc.data().CategoryName, id:doc.id});
          
            
        });
        var taskslist=[];
        //fetching all the lists of a specific user stored in the session if he issued a search query
        if(req.query.category){
            db.collection("TaskList").where("userId","==",req.session.userId).where("CategoryId","==",req.query.category).get()
            .then(snapshot=>{
                snapshot.forEach(doc=>{
                    taskslist.push({id:doc.id, data:doc.data()});
                });
                
                res.render("lists",{categories: categories,taskslist: taskslist});
            });

        }else
        {
        //render the lists page without any tasks since no category was chosen
        res.render("lists",{categories: categories,taskslist: taskslist});
        }
    })
    .catch(err=>{
        console.log('Error Getting Documents',err);
    });
    
    
});
app.post("/showlist/:listid/addtask",function(req,res){
    var tasks=[];


    db.collection("TaskList").doc(req.params.listid).get()
    .then(snapshot=>{
        if(snapshot.data().Task){
            tasks=tasks.concat(snapshot.data().Task);
        }
        tasks.push(req.body.newtask);
        db.collection("TaskList").doc(req.params.listid).update({Task: tasks});
        res.redirect("/showlist/"+req.params.listid);
    });

  

});
app.post("/showlist/:listid/removetask",function(req,res){
    var tasks=[];
    var completeTask = req.body.check;
    var complete=[];
    
    
    db.collection("TaskList").doc(req.params.listid).get()
    .then(snapshot=>{
        if(snapshot.data().Task){
            tasks=tasks.concat(snapshot.data().Task);
        }
        if(snapshot.data().Completed){
            complete=complete.concat(snapshot.data().Completed);
        }
       
            //check for the "typeof" the different completed task, then add into the complete task
        if (typeof completeTask === "string") {
            complete.push(completeTask);
            //check if the completed task already exits in the task when checked, then remove it
            tasks.splice(tasks.indexOf(completeTask), 1);
        } else if (typeof completeTask === "object") {
            for (var i = 0; i < completeTask.length; i++) {
                complete.push(completeTask[i]);
                tasks.splice(tasks.indexOf(completeTask[i]), 1);
            }
        }
    db.collection("TaskList").doc(req.params.listid).update({Task: tasks, Completed: complete});
    res.redirect("/showlist/"+req.params.listid);
    });

   
});
//get route for seeing the contents of a certain list
app.get("/showlist/:listid",function(req,res){
    db.collection("TaskList").doc(req.params.listid).get()
    .then(snapshot=>{
        res.render("list",{listid: snapshot.id, listdata: snapshot.data()});
    });
});
//get route for list deletion requests
app.get("/deletelist/:listid",function(req,res){
    var deleteDoc = db.collection('TaskList').doc(req.params.listid).delete();
});

//set app to listen on port 3000
app.listen(3000, function() {
   console.log("server is running on port 3000");
});
//firebase hosting not used
//exports.app = functions.https.onRequest(app);